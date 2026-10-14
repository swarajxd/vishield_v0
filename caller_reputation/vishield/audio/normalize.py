"""Decode bytes to mono float32 at a fixed sample rate, peak-normalise and trim silence.

WAV decoding needs only ``soundfile``. MP3/M4A decoding goes through ``librosa`` which
delegates to ``audioread``/ffmpeg; if ffmpeg is missing a clear ``DecodeError`` is raised.
"""

from __future__ import annotations

import io
import warnings
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray


class DecodeError(ValueError):
    pass


@dataclass(frozen=True)
class NormalizedAudio:
    samples: NDArray[np.float32]
    sample_rate: int

    @property
    def duration_seconds(self) -> float:
        return float(len(self.samples)) / self.sample_rate


def decode_bytes(data: bytes, extension: str) -> tuple[NDArray[np.float32], int]:
    """Decode WAV via soundfile, other formats via librosa/audioread."""
    if extension == ".wav":
        try:
            import soundfile as sf

            samples, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)
        except Exception as exc:
            raise DecodeError(f"Could not decode WAV: {exc.__class__.__name__}") from exc
        return samples.mean(axis=1).astype(np.float32), int(sr)
    try:
        import librosa

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            samples, sr = librosa.load(io.BytesIO(data), sr=None, mono=True)
    except Exception as exc:
        raise DecodeError(
            f"Could not decode {extension} (is ffmpeg installed?): {exc.__class__.__name__}"
        ) from exc
    return np.asarray(samples, dtype=np.float32), int(sr)


def normalize(
    samples: NDArray[np.float32],
    sample_rate: int,
    target_sample_rate: int = 16_000,
    trim_db: float | None = 30.0,
) -> NormalizedAudio:
    """Resample, remove DC offset, peak-normalise to 0.95 and optionally trim edge silence.

    Passing ``trim_db=None`` disables silence trimming, preserving exact timeline timestamps
    for streaming ingestion.
    """
    import librosa

    if samples.ndim != 1:
        samples = samples.reshape(-1)
    if samples.size == 0:
        return NormalizedAudio(
            samples=np.zeros(0, dtype=np.float32), sample_rate=target_sample_rate
        )
    if sample_rate != target_sample_rate:
        samples = librosa.resample(samples, orig_sr=sample_rate, target_sr=target_sample_rate)
    samples = samples - float(np.mean(samples))
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    if peak > 1e-6:
        samples = samples * (0.95 / peak)
    if trim_db is not None:
        trimmed, _ = librosa.effects.trim(samples, top_db=trim_db)
        if trimmed.size == 0:
            trimmed = samples
        samples = trimmed
    return NormalizedAudio(samples=samples.astype(np.float32), sample_rate=target_sample_rate)


def load_and_normalize(
    data: bytes,
    extension: str,
    target_sample_rate: int,
    trim_db: float | None = 30.0,
) -> NormalizedAudio:
    samples, sr = decode_bytes(data, extension)
    return normalize(samples, sr, target_sample_rate, trim_db=trim_db)

