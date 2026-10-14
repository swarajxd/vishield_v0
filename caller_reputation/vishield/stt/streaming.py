"""Streaming speech-to-text Protocol and phrase definitions."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol

from vishield.domain.models import AudioChunk, TranscriptChunk


@dataclass(frozen=True)
class RecognizedPhrase:
    """A continuous phrase recognised by a speech recognition engine."""

    text: str
    language: str
    offset_ms: int
    duration_ms: int


class StreamingSpeechToText(Protocol):
    """Protocol for streaming / chunked speech recognition backends.

    Additive to the existing batch SpeechToText protocol.
    Implementations must never log raw audio, transcript text, or API credentials.
    """

    name: str

    async def start(self, call_id: str) -> None:
        """Initialize and start a recognition session for the given call_id."""
        ...

    async def push(self, chunk: AudioChunk) -> None:
        """Push a 16 kHz 16-bit mono PCM AudioChunk into the recognizer."""
        ...

    async def finish(self) -> None:
        """Signal end of stream and flush all pending recognition results."""
        ...

    def transcript_chunks(self) -> AsyncIterator[TranscriptChunk]:
        """Asynchronously yield mapped TranscriptChunks as recognition progresses."""
        ...

    def phrases(self) -> AsyncIterator[RecognizedPhrase]:
        """Asynchronously yield individual RecognizedPhrases as they arrive."""
        ...
