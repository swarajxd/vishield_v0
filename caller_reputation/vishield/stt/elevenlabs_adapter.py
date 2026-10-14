"""ElevenLabs Scribe speech-to-text adapter (cloud-based STT via REST API).

Transcribes audio using ElevenLabs Scribe API. The API key is stored securely as a
``SecretStr`` and never leaked in logs, exceptions, or serialized models.
"""

from __future__ import annotations

import asyncio
import io
from collections.abc import AsyncIterator
from typing import Any

import numpy as np
import requests
from numpy.typing import NDArray
from pydantic import SecretStr

from vishield.audio.chunker import pcm16_to_float32
from vishield.domain.models import AudioChunk, TranscriptChunk
from vishield.stt.base import STTUnavailableError, Transcription, TranscriptSegment
from vishield.stt.language import resolve_chunk_language
from vishield.stt.streaming import RecognizedPhrase


class ElevenLabsSpeechToText:
    """Batch speech-to-text adapter using ElevenLabs Scribe REST endpoint."""

    name = "elevenlabs"

    def __init__(
        self,
        api_key: SecretStr | str | None = None,
        model_id: str = "scribe_v1",
        timeout: float = 60.0,
    ) -> None:
        if isinstance(api_key, str):
            self._api_key: SecretStr | None = SecretStr(api_key) if api_key.strip() else None
        else:
            self._api_key = api_key
        self.model_id = model_id
        self.timeout = timeout

    @property
    def has_api_key(self) -> bool:
        return self._api_key is not None and bool(self._api_key.get_secret_value().strip())

    def transcribe(self, samples: NDArray[np.float32], sample_rate: int) -> Transcription:
        """Send audio samples to ElevenLabs Scribe for speech recognition."""
        if not self.has_api_key or self._api_key is None:
            raise STTUnavailableError(
                "ElevenLabs API key is not configured. Set ELEVEN_LABS_API_KEY in .env."
            )

        if len(samples) == 0:
            return Transcription(
                text="",
                backend=f"{self.name}:{self.model_id}",
                language=None,
                segments=[],
            )

        import soundfile as sf

        buf = io.BytesIO()
        sf.write(buf, samples, sample_rate, format="WAV", subtype="PCM_16")
        audio_bytes = buf.getvalue()

        headers = {
            "xi-api-key": self._api_key.get_secret_value(),
        }
        files = {
            "file": ("audio.wav", io.BytesIO(audio_bytes), "audio/wav"),
        }
        data = {
            "model_id": self.model_id,
        }

        try:
            resp = requests.post(
                "https://api.elevenlabs.io/v1/speech-to-text",
                headers=headers,
                files=files,
                data=data,
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise STTUnavailableError(
                f"ElevenLabs transcription request failed: {exc.__class__.__name__}"
            ) from exc

        if resp.status_code != 200:
            err_msg = resp.text[:200]
            try:
                err_json = resp.json()
                if isinstance(err_json, dict):
                    err_msg = str(err_json.get("detail", err_json.get("message", err_msg)))
            except (ValueError, requests.JSONDecodeError):
                err_msg = resp.text[:200]
            raise STTUnavailableError(
                f"ElevenLabs API error (status {resp.status_code}): {err_msg}"
            )

        try:
            payload: dict[str, Any] = resp.json()
        except Exception as exc:
            raise STTUnavailableError("Failed to parse ElevenLabs response as JSON") from exc

        text = str(payload.get("text", "")).strip()
        raw_lang = payload.get("language_code")
        language = raw_lang.strip() if isinstance(raw_lang, str) else None

        words = payload.get("words", [])
        duration_s = float(len(samples)) / float(sample_rate) if sample_rate > 0 else 0.0
        segments: list[TranscriptSegment] = []

        if isinstance(words, list) and words:
            start_s = float(words[0].get("start", 0.0))
            end_s = float(words[-1].get("end", duration_s))
            segments.append(TranscriptSegment(start=start_s, end=end_s, text=text))
        elif text:
            segments.append(TranscriptSegment(start=0.0, end=duration_s, text=text))

        return Transcription(
            text=text,
            backend=f"{self.name}:{self.model_id}",
            language=language,
            segments=segments,
        )


class ElevenLabsChunkedSTT:
    """Streaming adapter using ElevenLabs Scribe per audio chunk."""

    name = "elevenlabs"

    def __init__(
        self,
        api_key: SecretStr | str | None = None,
        model_id: str = "scribe_v1",
        emit_empty_chunks: bool = False,
        elevenlabs_instance: ElevenLabsSpeechToText | None = None,
    ) -> None:
        self.model_id = model_id
        self.emit_empty_chunks = emit_empty_chunks
        self._elevenlabs = elevenlabs_instance or ElevenLabsSpeechToText(
            api_key=api_key, model_id=model_id
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

        loop = asyncio.get_running_loop()
        # Run blocking HTTP call in thread pool to maintain event-loop responsiveness
        transcription = await loop.run_in_executor(
            None, self._elevenlabs.transcribe, samples, 16_000
        )
        text = transcription.text.strip()

        if not text and not self.emit_empty_chunks:
            return

        lang = resolve_chunk_language(
            text=text,
            phrase_languages=[transcription.language] if transcription.language else None,
            default_lang="en-IN",
        )

        offset_s = float(chunk.start_ms) / 1000.0
        phrase = RecognizedPhrase(
            text=text,
            language=lang,
            offset_ms=chunk.start_ms,
            duration_ms=max(0, chunk.end_ms - chunk.start_ms),
        )
        self._phrase_history.append(phrase)
        await self._phrases_queue.put(phrase)

        t_chunk = TranscriptChunk(
            call_id=self.call_id,
            chunk_id=chunk.chunk_id,
            text=text,
            language=lang,
            timestamp=offset_s,
        )
        self._history.append(t_chunk)
        await self._chunks_queue.put(t_chunk)

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

    def get_full_transcript(self) -> str:
        return " ".join(c.text for c in self._history if c.text).strip()
