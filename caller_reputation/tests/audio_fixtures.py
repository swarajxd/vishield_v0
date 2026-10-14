"""Tiny synthetic audio generated at test time. No audio files are committed."""

from __future__ import annotations

import io

import numpy as np
import soundfile as sf
from numpy.typing import NDArray


def synthetic_speechlike(
    duration: float = 2.0, sr: int = 16_000, seed: int = 42
) -> NDArray[np.float32]:
    """Amplitude-modulated harmonic tone with gaps, loosely mimicking syllables and pauses."""
    rng = np.random.default_rng(seed)
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    f0 = 140 + 20 * np.sin(2 * np.pi * 0.7 * t)
    phase = 2 * np.pi * np.cumsum(f0) / sr
    signal = np.sin(phase) + 0.4 * np.sin(2 * phase) + 0.2 * np.sin(3 * phase)
    envelope = (np.sin(2 * np.pi * 4 * t) > 0).astype(np.float32)
    envelope[int(0.9 * sr) : int(1.4 * sr)] = 0.0
    noise = 0.01 * rng.standard_normal(len(t))
    out = (signal * envelope + noise).astype(np.float32)
    return out / np.max(np.abs(out))


def wav_bytes(samples: NDArray[np.float32], sr: int = 16_000) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, samples, sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()
