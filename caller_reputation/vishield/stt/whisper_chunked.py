"""Offline streaming STT adapter transcribing chunks via faster-whisper."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from vishield.audio.chunker import pcm16_to_float32
from vishield.domain.models import AudioChunk, TranscriptChunk
from vishield.stt.language import resolve_chunk_language
from vishield.stt.streaming import RecognizedPhrase
from vishield.stt.whisper_adapter import FasterWhisperSpeechToText


class WhisperChunkedSTT:
    """Offline streaming STT adapter using faster-whisper per chunk.

    Operates without any external Azure account or network access, ideal
    for offline development, CI, and local demonstrations.
    """

    name = "whisper"

    def __init__(
        self,
        model_size: str = "base",
        compute_type: str = "int8",
        emit_empty_chunks: bool = False,
        whisper_instance: FasterWhisperSpeechToText | None = None,
    ) -> None:
        self.model_size = model_size
        self.compute_type = compute_type
        self.emit_empty_chunks = emit_empty_chunks
        self._whisper = whisper_instance or FasterWhisperSpeechToText(
            model_size=model_size, compute_type=compute_type
        )
        self.call_id: str = ""
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
        samples = pcm16_to_float32(chunk.pcm)
        if len(samples) == 0:
            return

        # Run transcription on the 16 kHz samples
        transcription = self._whisper.transcribe(samples, sample_rate=16_000)
        text = transcription.text.strip()

        if not text and not self.emit_empty_chunks:
            return

        resolved_lang = resolve_chunk_language(
            text, [transcription.language] if transcription.language else []
        )
        timestamp = round(chunk.start_ms / 1000.0, 3)

        transcript_chunk = TranscriptChunk(
            call_id=chunk.call_id,
            chunk_id=chunk.chunk_id,
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
