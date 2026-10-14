"""Speech-to-text interface."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import numpy as np
from numpy.typing import NDArray


class STTUnavailableError(RuntimeError):
    """The configured backend cannot run (missing optional dependency or model)."""


@dataclass(frozen=True)
class TranscriptSegment:
    start: float
    end: float
    text: str


@dataclass(frozen=True)
class Transcription:
    text: str
    backend: str
    language: str | None = None
    segments: list[TranscriptSegment] = field(default_factory=list)


class SpeechToText(Protocol):
    name: str

    def transcribe(self, samples: NDArray[np.float32], sample_rate: int) -> Transcription:
        """Transcribe mono float32 PCM. Must not persist the audio."""
