"""Deterministic mock backend for tests, CI and low-resource demos."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

import numpy as np
from numpy.typing import NDArray

from vishield.domain.models import AudioChunk, TranscriptChunk
from vishield.stt.base import Transcription, TranscriptSegment
from vishield.stt.streaming import RecognizedPhrase


class MockSpeechToText:
    """Returns a fixed transcript regardless of audio content.

    The default text is intentionally benign so a mis-configured deployment never produces
    alarming output by accident.
    """

    name = "mock"

    def __init__(self, fixed_text: str = "") -> None:
        self.fixed_text = fixed_text

    def transcribe(self, samples: NDArray[np.float32], sample_rate: int) -> Transcription:
        duration = float(len(samples)) / sample_rate if sample_rate else 0.0
        text = self.fixed_text or (
            "[mock transcript] Speech-to-text backend is set to 'mock'. Use the typed-transcript "
            "mode or install the whisper extra for real transcription."
        )
        return Transcription(
            text=text,
            backend=self.name,
            language="en",
            segments=[TranscriptSegment(start=0.0, end=duration, text=text)],
        )


class MockStreamingSTT:
    """Deterministic, scripted streaming speech-to-text backend for tests, CI and local demos."""

    name = "mock"

    def __init__(
        self,
        script: dict[int, tuple[str, str]] | list[tuple[str, str]] | None = None,
        default_language: str = "en-IN",
    ) -> None:
        self.call_id: str = ""
        self.default_language = default_language
        self._script: dict[int, tuple[str, str]] = {}
        if isinstance(script, dict):
            self._script = dict(script)
        elif isinstance(script, list):
            self._script = {i: item for i, item in enumerate(script)}
        self._chunks_queue: asyncio.Queue[TranscriptChunk | None] = asyncio.Queue()
        self._phrases_queue: asyncio.Queue[RecognizedPhrase | None] = asyncio.Queue()
        self._history: list[TranscriptChunk] = []
        self._phrase_history: list[RecognizedPhrase] = []
        self._finished = False

    async def start(self, call_id: str) -> None:
        self.call_id = call_id
        self._chunks_queue = asyncio.Queue()
        self._phrases_queue = asyncio.Queue()
        self._history = []
        self._phrase_history = []
        self._finished = False

    async def push(self, chunk: AudioChunk) -> None:
        chunk_id = chunk.chunk_id
        if chunk_id in self._script:
            text, raw_lang = self._script[chunk_id]
        else:
            default_samples = [
                ("Hello, this is security from your bank calling.", "en-IN"),
                ("We noticed suspicious activity on your account.", "en-IN"),
                ("Aapka account block ho sakta hai, please OTP share kijiye.", "hinglish"),
                ("कृपया अपना पासवर्ड या पिन किसी से साझा न करें।", "hi-IN"),
            ]
            text, raw_lang = default_samples[chunk_id % len(default_samples)]

        from vishield.stt.language import resolve_chunk_language

        resolved_lang = resolve_chunk_language(text, [raw_lang], default_lang=self.default_language)
        timestamp = round(chunk.start_ms / 1000.0, 3)

        transcript_chunk = TranscriptChunk(
            call_id=chunk.call_id,
            chunk_id=chunk_id,
            text=text,
            language=resolved_lang,
            timestamp=timestamp,
        )
        phrase = RecognizedPhrase(
            text=text,
            language=resolved_lang,
            offset_ms=chunk.start_ms,
            duration_ms=max(0, chunk.end_ms - chunk.start_ms),
        )

        self._history.append(transcript_chunk)
        self._phrase_history.append(phrase)
        await self._chunks_queue.put(transcript_chunk)
        await self._phrases_queue.put(phrase)

    async def finish(self) -> None:
        self._finished = True
        await self._chunks_queue.put(None)
        await self._phrases_queue.put(None)

    async def transcript_chunks(self) -> AsyncIterator[TranscriptChunk]:
        if self._finished and self._chunks_queue.empty():
            for item in self._history:
                yield item
            return

        while True:
            chunk = await self._chunks_queue.get()
            if chunk is None:
                break
            yield chunk

    async def phrases(self) -> AsyncIterator[RecognizedPhrase]:
        if self._finished and self._phrases_queue.empty():
            for item in self._phrase_history:
                yield item
            return

        while True:
            phrase = await self._phrases_queue.get()
            if phrase is None:
                break
            yield phrase

