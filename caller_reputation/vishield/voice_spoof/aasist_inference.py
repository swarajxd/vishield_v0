"""
aasist_inference.py
-------------------
Production inference module for the SSL-AASIST voice anti-spoofing component.

This is the entry point your teammate's fusion pipeline calls. It:
  1. Loads a single audio file (WAV / FLAC)
  2. Runs the SSL-AASIST model
  3. Returns a normalized voice_spoof_score ∈ [0.0, 1.0]
     ready for the Risk Fusion Engine

Quick start
-----------
    from app.aasist_inference import AASISTInferenceEngine

    engine = AASISTInferenceEngine()          # loads best checkpoint once
    result = engine.score_file("call.flac", call_id="call-100")
    print(result)
    # {'call_id': 'call-100', 'voice_spoof_score': 0.027692}

Or from a raw waveform tensor already in memory:
    result = engine.score_tensor(waveform_tensor, call_id="call-100")
"""

import os
import sys
import torch
import torch.nn.functional as F
import torchaudio

# --- path bootstrapping so this works from any CWD ---
# __file__ = e:\vieshield\ssl_aasist\app\aasist_inference.py
# _HERE    = e:\vieshield\ssl_aasist\app
# _ROOT    = e:\vieshield\ssl_aasist          (one level up)
_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.abspath(os.path.join(_HERE, ".."))  # ssl_aasist root
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from model_ssl_aasist import SSL_AASIST
from app.adapters.aasist_adapter import (
    AASISTAdapter,
    AASISTOutputMode,
    RawAASISTOutput,
    VoiceSpoofSignal,
)

# ---------------------------------------------------------------------------
# Constants — keep in sync with training pipeline
# ---------------------------------------------------------------------------
DEFAULT_CKPT   = os.path.join(_ROOT, "checkpoints", "best_dev_eer.pth")
TARGET_SR      = 16_000          # SSL wav2vec2 expects 16 kHz
TARGET_LENGTH  = 64_600          # ~4 s at 16 kHz  (same as dataset_ssl.py)


# ---------------------------------------------------------------------------
# Audio pre-processing (mirrors dataset_ssl.py)
# ---------------------------------------------------------------------------

def _load_and_pad(path: str) -> torch.Tensor:
    """
    Load audio, resample to 16 kHz, convert to mono, pad/trim to TARGET_LENGTH.
    Supports: WAV, FLAC, MP3, MP4, OGG, OPUS, M4A (requires ffmpeg on PATH).
    Returns a 1-D float tensor of shape [TARGET_LENGTH].
    """
    ext = os.path.splitext(path)[1].lower()

    # Try torchaudio with ffmpeg dispatcher for compressed/container formats
    if ext in (".mp3", ".mp4", ".m4a", ".ogg", ".opus", ".aac", ".webm"):
        try:
            waveform, sr = torchaudio.load(path, backend="ffmpeg")
        except Exception:
            # ffmpeg not available — try sox dispatcher as fallback
            try:
                waveform, sr = torchaudio.load(path, backend="sox")
            except Exception:
                raise RuntimeError(
                    f"Cannot load '{os.path.basename(path)}' ({ext}). "
                    "Install ffmpeg: `conda install -c conda-forge ffmpeg`"
                )
    else:
        # WAV / FLAC — soundfile handles these natively
        waveform, sr = torchaudio.load(path)

    # Resample if needed
    if sr != TARGET_SR:
        waveform = torchaudio.functional.resample(waveform, orig_freq=sr, new_freq=TARGET_SR)

    # Mono
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)

    waveform = waveform.squeeze(0)  # [samples]

    # Pad or trim to fixed length
    n = waveform.shape[0]
    if n < TARGET_LENGTH:
        # repeat-pad (matches dataset_ssl.py behaviour)
        repeats = (TARGET_LENGTH // n) + 1
        waveform = waveform.repeat(repeats)
    waveform = waveform[:TARGET_LENGTH]

    return waveform


def _prepare_tensor(waveform: torch.Tensor) -> torch.Tensor:
    """Ensure waveform is correctly shaped [TARGET_LENGTH] and pad/trim."""
    waveform = waveform.squeeze()
    if waveform.dim() != 1:
        raise ValueError(f"Expected 1-D waveform, got shape {waveform.shape}")
    n = waveform.shape[0]
    if n < TARGET_LENGTH:
        repeats = (TARGET_LENGTH // n) + 1
        waveform = waveform.repeat(repeats)
    return waveform[:TARGET_LENGTH]


# ---------------------------------------------------------------------------
# Main inference engine
# ---------------------------------------------------------------------------

class AASISTInferenceEngine:
    """
    Singleton-friendly wrapper around SSL_AASIST for production inference.

    Parameters
    ----------
    ckpt_path : str
        Path to the trained model weights (.pth / .pt).
        Defaults to  checkpoints/best_dev_eer.pth.
    device : str | torch.device | None
        'cuda', 'cpu', or None (auto-detect).
    """

    def __init__(
        self,
        ckpt_path: str = DEFAULT_CKPT,
        device=None,
    ):
        if device is None:
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.device = torch.device(device)

        # --- Load model ---
        self._model = SSL_AASIST(device=self.device).to(self.device)
        ck = torch.load(ckpt_path, map_location=self.device, weights_only=False)

        if isinstance(ck, dict) and "model" in ck:
            state = ck["model"]
        elif isinstance(ck, dict) and "model_cpu" in ck:
            state = {k: v.to(self.device) for k, v in ck["model_cpu"].items()}
        else:
            state = ck  # bare state_dict

        self._model.load_state_dict(state)
        self._model.eval()

        self._adapter = AASISTAdapter()
        print(f"[AASISTInferenceEngine] Loaded checkpoint: {ckpt_path}")
        print(f"[AASISTInferenceEngine] Running on: {self.device}")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def score_file(
        self,
        audio_path: str,
        call_id: str,
        utterance_id: str | None = None,
    ) -> dict:
        """
        Score a single audio file.

        Parameters
        ----------
        audio_path : str
            Path to a WAV or FLAC file.
        call_id : str
            Unique call identifier (passed through to fusion engine).
        utterance_id : str, optional
            Optional ASVspoof-style utterance ID for logging.

        Returns
        -------
        dict  with keys:
            call_id            – echoed back
            voice_spoof_score  – float in [0.0, 1.0]
        """
        waveform = _load_and_pad(audio_path)
        return self._run(waveform, call_id, utterance_id)

    def score_tensor(
        self,
        waveform: torch.Tensor,
        call_id: str,
        utterance_id: str | None = None,
    ) -> dict:
        """
        Score a raw waveform tensor already in memory.

        Parameters
        ----------
        waveform : torch.Tensor
            1-D float tensor. Will be padded/trimmed to TARGET_LENGTH.
        call_id : str
        utterance_id : str, optional

        Returns
        -------
        dict  with keys:
            call_id            – echoed back
            voice_spoof_score  – float in [0.0, 1.0]
        """
        waveform = _prepare_tensor(waveform)
        return self._run(waveform, call_id, utterance_id)

    def score_file_batch(
        self,
        audio_paths: list[str],
        call_ids: list[str],
    ) -> list[dict]:
        """
        Score a batch of audio files efficiently.

        Parameters
        ----------
        audio_paths : list[str]  – paths to audio files
        call_ids    : list[str]  – matching call identifiers

        Returns
        -------
        list[dict]  one dict per file, each with call_id + voice_spoof_score
        """
        if len(audio_paths) != len(call_ids):
            raise ValueError("audio_paths and call_ids must have the same length")

        waveforms = torch.stack([_load_and_pad(p) for p in audio_paths])
        return self._run_batch(waveforms, call_ids)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @torch.no_grad()
    def _run(
        self,
        waveform: torch.Tensor,
        call_id: str,
        utterance_id: str | None,
    ) -> dict:
        x = waveform.unsqueeze(0).to(self.device)   # [1, T]
        out = self._model(x)                          # [1, 2]  logits
        # bonafide_logit - spoof_logit  (same formula as test_best.py)
        z = (out[0, 1] - out[0, 0]).item()

        signal: VoiceSpoofSignal = self._adapter.normalize(
            RawAASISTOutput(
                call_id=call_id,
                value=z,
                mode=AASISTOutputMode.BONAFIDE_MINUS_SPOOF_LOGIT,
                utterance_id=utterance_id,
            )
        )
        return signal.to_dict()

    @torch.no_grad()
    def _run_batch(
        self,
        waveforms: torch.Tensor,
        call_ids: list[str],
    ) -> list[dict]:
        x   = waveforms.to(self.device)              # [B, T]
        out = self._model(x)                          # [B, 2]  logits
        zs  = (out[:, 1] - out[:, 0]).cpu().tolist()  # bonafide − spoof

        results = []
        for call_id, z in zip(call_ids, zs):
            signal = self._adapter.normalize(
                RawAASISTOutput(
                    call_id=call_id,
                    value=z,
                    mode=AASISTOutputMode.BONAFIDE_MINUS_SPOOF_LOGIT,
                )
            )
            results.append(signal.to_dict())
        return results


# ---------------------------------------------------------------------------
# CLI smoke-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Quick CLI test of AASISTInferenceEngine")
    parser.add_argument("audio", help="Path to a WAV or FLAC file")
    parser.add_argument("--call_id", default="test-call-001")
    parser.add_argument(
        "--ckpt",
        default=DEFAULT_CKPT,
        help="Checkpoint path (default: best_dev_eer.pth)",
    )
    args = parser.parse_args()

    engine = AASISTInferenceEngine(ckpt_path=args.ckpt)
    result = engine.score_file(args.audio, call_id=args.call_id)
    print("\n--- Result ---")
    print(result)
    score = result["voice_spoof_score"]
    label = "SPOOF" if score >= 0.5 else "BONAFIDE"
    print(f"Interpretation: {label}  (score={score:.4f})")
