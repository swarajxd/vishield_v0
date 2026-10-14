"""Locally runnable Whisper-compatible backend via ``faster-whisper`` (optional extra)."""

from __future__ import annotations

from typing import Any

import numpy as np
from numpy.typing import NDArray

from vishield.stt.base import STTUnavailableError, Transcription, TranscriptSegment


class FasterWhisperSpeechToText:
    """Lazy-loads the model on first use so importing the package never downloads anything."""

    name = "faster-whisper"

    def __init__(self, model_size: str = "base", compute_type: str = "int8") -> None:
        self.model_size = model_size
        self.compute_type = compute_type
        self._model: Any | None = None

    def _load(self) -> Any:
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
            except ImportError as exc:
                raise STTUnavailableError(
                    "faster-whisper is not installed. Run `pip install -e '.[stt]'` or set "
                    "VISHIELD_STT_BACKEND=mock."
                ) from exc
            try:
                self._model = WhisperModel(
                    self.model_size, device="cpu", compute_type=self.compute_type
                )
            except Exception as exc:
                raise STTUnavailableError(
                    f"Could not load whisper model '{self.model_size}': {exc.__class__.__name__}"
                ) from exc
        return self._model

    def transcribe(self, samples: NDArray[np.float32], sample_rate: int) -> Transcription:
        if sample_rate != 16_000:
            raise ValueError("faster-whisper expects 16 kHz mono float32 input")
        model = self._load()
        segments_iter, info = model.transcribe(
            samples,
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )
        segments = [
            TranscriptSegment(start=float(s.start), end=float(s.end), text=s.text.strip())
            for s in segments_iter
        ]
        text = " ".join(s.text for s in segments).strip()
        # Fallback without VAD if silence filter pruned quiet voice
        if not text and len(samples) > 0:
            segments_iter, info = model.transcribe(samples, beam_size=5, vad_filter=False)
            segments = [
                TranscriptSegment(start=float(s.start), end=float(s.end), text=s.text.strip())
                for s in segments_iter
            ]
            text = " ".join(s.text for s in segments).strip()

        return Transcription(
            text=text,
            backend=f"{self.name}:{self.model_size}",
            language=getattr(info, "language", None),
            segments=segments,
        )
