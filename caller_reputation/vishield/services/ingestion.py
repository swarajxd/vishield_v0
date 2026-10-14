"""Orchestration service for streaming audio ingestion and speech-to-text fan-out."""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field

from vishield.audio.chunker import chunk_audio_stream
from vishield.audio.normalize import DecodeError, load_and_normalize
from vishield.audio.validation import AudioValidationError, validate_duration, validate_upload
from vishield.config import Settings
from vishield.domain.models import AudioChunk, TranscriptChunk
from vishield.infra.metrics import record_chunk_latency
from vishield.infra.transcript_buffer import TranscriptBuffer, build_transcript_buffer
from vishield.stt.factory import build_streaming_stt
from vishield.stt.streaming import StreamingSpeechToText

log = logging.getLogger(__name__)


@dataclass
class CallSession:
    """Tracks running state, queues, and metadata for a single call session."""

    call_id: str
    status: str = "starting"  # "starting" | "processing" | "completed" | "failed"
    chunks_total: int = 0
    chunks_processed: int = 0
    audio_queue: asyncio.Queue[AudioChunk | None] = field(default_factory=asyncio.Queue)
    transcript_queue: asyncio.Queue[TranscriptChunk | None] = field(default_factory=asyncio.Queue)
    error: Exception | None = None
    started_at: float = field(default_factory=time.monotonic)
    task: asyncio.Task[None] | None = None



class IngestionService:
    """Orchestrates audio decoding, chunking, streaming STT, and queue fan-out.

    Fan-out streams:
      1. AudioChunk queue: consumed by voice-authenticity (AASIST) stage without re-decoding.
      2. TranscriptChunk queue: consumed by downstream LLM/rule engine and WebSocket routes.
    """

    def __init__(
        self,
        settings: Settings,
        stt: StreamingSpeechToText | None = None,
        buffer: TranscriptBuffer | None = None,
    ) -> None:
        self.settings = settings
        self.stt = stt or build_streaming_stt(settings)
        self.buffer = buffer or build_transcript_buffer(settings)
        self._sessions: dict[str, CallSession] = {}

    def get_session(self, call_id: str) -> CallSession | None:
        return self._sessions.get(call_id)

    def cleanup_session(self, call_id: str) -> None:
        """Purge in-memory call state and buffer contents for call_id."""
        self._sessions.pop(call_id, None)
        self.buffer.delete(call_id)

    def get_transcript(self, call_id: str) -> tuple[str, list[TranscriptChunk]]:
        """Return (conversation_so_far, list_of_chunks) for the call."""
        return self.buffer.context(call_id), self.buffer.chunks(call_id)

    async def ingest_audio_bytes(
        self,
        data: bytes,
        filename: str | None,
        content_type: str | None,
        call_id: str | None = None,
        realtime: bool | None = None,
    ) -> CallSession:
        """Validate, decode (without silence trimming), chunk, and stream audio through STT.

        Runs pipeline fan-out asynchronously in a background task while returning the CallSession.
        """
        meta = validate_upload(filename, content_type, data, self.settings)
        try:
            # Silence trimming is disabled (trim_db=None) to keep timeline timestamps synchronized
            audio = load_and_normalize(
                data,
                meta.extension,
                self.settings.target_sample_rate,
                trim_db=None,
            )
        except DecodeError as exc:
            raise AudioValidationError("undecodable", str(exc)) from exc

        validate_duration(audio.duration_seconds, self.settings)

        active_call_id = call_id or str(uuid.uuid4())
        session = CallSession(call_id=active_call_id)
        self._sessions[active_call_id] = session

        use_realtime = self.settings.ingest_realtime_default if realtime is None else realtime

        # Launch ingestion fan-out as an asynchronous task
        session.task = asyncio.create_task(
            self._process_stream(
                audio_samples=audio.samples,
                sample_rate=audio.sample_rate,
                session=session,
                realtime=use_realtime,
            )
        )
        return session

    async def _process_stream(
        self,
        audio_samples: object,
        sample_rate: int,
        session: CallSession,
        realtime: bool,
    ) -> None:
        call_id = session.call_id
        session.status = "processing"

        push_times: dict[int, float] = {}

        async def _collector_task() -> None:
            """Consume recognized transcript chunks from STT and fan out to buffer and queue."""
            try:
                async for t_chunk in self.stt.transcript_chunks():
                    chunk_id = t_chunk.chunk_id
                    now = time.perf_counter()
                    if chunk_id in push_times:
                        latency = now - push_times[chunk_id]
                        record_chunk_latency(latency)
                        log.info(
                            "STT chunk emitted for call_id=%s, chunk_id=%d, latency=%.3fs",
                            call_id,
                            chunk_id,
                            latency,
                        )

                    # Append to running transcript buffer (applies redaction if enabled)
                    self.buffer.append(t_chunk)
                    session.chunks_processed += 1
                    await session.transcript_queue.put(t_chunk)
            except Exception as exc:
                log.exception("Error in STT transcript collection task: %s", exc)
                session.error = exc

        collector: asyncio.Task[None] | None = None
        try:
            # Start the recognizer *before* the collector so queue resets cannot strand it.
            await self.stt.start(call_id)
            collector = asyncio.create_task(_collector_task())

            async for chunk in chunk_audio_stream(
                audio_samples,  # type: ignore[arg-type]
                sample_rate=sample_rate,
                call_id=call_id,
                chunk_seconds=self.settings.ingest_chunk_seconds,
                realtime=realtime,
            ):
                session.chunks_total += 1
                push_times[chunk.chunk_id] = time.perf_counter()

                # Fan-out 1: push to audio_queue for voice authenticity (AASIST) teammate
                await session.audio_queue.put(chunk)

                # Fan-out 2: push to streaming STT recognizer
                await self.stt.push(chunk)

            # Signal end of input audio stream
            await self.stt.finish()
            if collector is not None:
                await collector

            session.status = "completed"
        except Exception as exc:
            log.exception("Error processing audio stream for call %s: %s", call_id, exc)
            session.status = "failed"
            session.error = exc
            if collector is not None and not collector.done():
                collector.cancel()
        finally:
            # Signal completion to queues
            await session.audio_queue.put(None)
            await session.transcript_queue.put(None)
