"""Running transcript buffers for live and simulated calls.

Provides InMemoryTranscriptBuffer and RedisTranscriptBuffer behind a common Protocol.
Redacts PII before storage and honours call-level TTL and explicit deletion.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any, Protocol

from vishield.domain.models import TranscriptChunk
from vishield.domain.redaction import redact

log = logging.getLogger(__name__)


class TranscriptBuffer(Protocol):
    """Protocol for persisting and retrieving conversational transcript chunks per call."""

    def append(self, chunk: TranscriptChunk) -> None:
        """Append a TranscriptChunk to the call buffer, redacting if enabled."""
        ...

    def context(self, call_id: str, last_n: int | None = None) -> str:
        """Return conversation text so far for the LLM/rules stage."""
        ...

    def chunks(self, call_id: str) -> list[TranscriptChunk]:
        """Return all chunks recorded for call_id in arrival order."""
        ...

    def delete(self, call_id: str) -> None:
        """Purge all stored data for call_id upon call end."""
        ...


class InMemoryTranscriptBuffer:
    """Thread-safe, in-memory transcript buffer with TTL eviction and max-calls cap."""

    def __init__(
        self,
        ttl_seconds: int = 3600,
        max_calls: int = 1000,
        redact_before_buffer: bool = True,
    ) -> None:
        self.ttl_seconds = ttl_seconds
        self.max_calls = max_calls
        self.redact_before_buffer = redact_before_buffer
        self._lock = threading.Lock()
        self._calls: dict[str, list[TranscriptChunk]] = {}
        self._timestamps: dict[str, float] = {}

    def _evict_expired(self, now: float) -> None:
        expired = [
            c_id
            for c_id, last_t in self._timestamps.items()
            if now - last_t > self.ttl_seconds
        ]
        for c_id in expired:
            self._calls.pop(c_id, None)
            self._timestamps.pop(c_id, None)

    def _evict_excess(self) -> None:
        while len(self._calls) > self.max_calls:
            oldest_call = min(self._timestamps, key=lambda k: self._timestamps[k])
            self._calls.pop(oldest_call, None)
            self._timestamps.pop(oldest_call, None)

    def append(self, chunk: TranscriptChunk) -> None:
        text = chunk.text
        if self.redact_before_buffer and text:
            text = redact(text).text

        stored_chunk = TranscriptChunk(
            call_id=chunk.call_id,
            chunk_id=chunk.chunk_id,
            text=text,
            language=chunk.language,
            timestamp=chunk.timestamp,
        )

        with self._lock:
            now = time.monotonic()
            self._evict_expired(now)

            if chunk.call_id not in self._calls:
                self._calls[chunk.call_id] = []
                self._evict_excess()

            self._calls[chunk.call_id].append(stored_chunk)
            self._timestamps[chunk.call_id] = now

    def context(self, call_id: str, last_n: int | None = None) -> str:
        with self._lock:
            now = time.monotonic()
            self._evict_expired(now)
            call_chunks = self._calls.get(call_id, [])
            if last_n is not None and last_n > 0:
                call_chunks = call_chunks[-last_n:]
            phrases = [c.text.strip() for c in call_chunks if c.text.strip()]
            return " ".join(phrases)

    def chunks(self, call_id: str) -> list[TranscriptChunk]:
        with self._lock:
            now = time.monotonic()
            self._evict_expired(now)
            return list(self._calls.get(call_id, []))

    def delete(self, call_id: str) -> None:
        with self._lock:
            self._calls.pop(call_id, None)
            self._timestamps.pop(call_id, None)


class RedisTranscriptBuffer:
    """Redis-backed transcript buffer (requires [redis] extra).

    Stores chunks as JSON in a Redis list per call with automated key expiration.
    """

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        ttl_seconds: int = 3600,
        redact_before_buffer: bool = True,
        redis_client: Any | None = None,
    ) -> None:
        self.redis_url = redis_url
        self.ttl_seconds = ttl_seconds
        self.redact_before_buffer = redact_before_buffer
        self._client = redis_client

    def _get_client(self) -> Any:
        if self._client is None:
            try:
                import redis

                self._client = redis.Redis.from_url(self.redis_url, decode_responses=True)
            except ImportError as exc:
                raise RuntimeError(
                    "redis package is not installed. Install it with `pip install -e '.[redis]'` "
                    "or set VISHIELD_TRANSCRIPT_BUFFER_BACKEND=memory."
                ) from exc
            except Exception as exc:
                raise RuntimeError(
                    f"Could not connect to Redis at {self.redis_url}: {exc}"
                ) from exc
        return self._client

    def _key(self, call_id: str) -> str:
        return f"vishield:transcript:{call_id}"

    def append(self, chunk: TranscriptChunk) -> None:
        client = self._get_client()
        text = chunk.text
        if self.redact_before_buffer and text:
            text = redact(text).text

        stored_chunk = TranscriptChunk(
            call_id=chunk.call_id,
            chunk_id=chunk.chunk_id,
            text=text,
            language=chunk.language,
            timestamp=chunk.timestamp,
        )

        key = self._key(chunk.call_id)
        payload = stored_chunk.model_dump_json()
        client.rpush(key, payload)
        client.expire(key, self.ttl_seconds)

    def chunks(self, call_id: str) -> list[TranscriptChunk]:
        client = self._get_client()
        key = self._key(call_id)
        raw_items = client.lrange(key, 0, -1) or []
        results: list[TranscriptChunk] = []
        for raw in raw_items:
            results.append(TranscriptChunk.model_validate_json(raw))
        return results

    def context(self, call_id: str, last_n: int | None = None) -> str:
        all_chunks = self.chunks(call_id)
        if last_n is not None and last_n > 0:
            all_chunks = all_chunks[-last_n:]
        phrases = [c.text.strip() for c in all_chunks if c.text.strip()]
        return " ".join(phrases)

    def delete(self, call_id: str) -> None:
        client = self._get_client()
        key = self._key(call_id)
        client.delete(key)


def build_transcript_buffer(
    settings: Any,
    redis_client: Any | None = None,
) -> TranscriptBuffer:
    """Build the configured transcript buffer based on runtime settings."""
    backend = getattr(settings, "transcript_buffer_backend", "memory")
    ttl = getattr(settings, "transcript_ttl_seconds", 3600)
    redact_flag = getattr(settings, "ingest_redact_before_buffer", True)

    if backend == "redis":
        url = getattr(settings, "redis_url", "redis://localhost:6379/0")
        return RedisTranscriptBuffer(
            redis_url=url,
            ttl_seconds=ttl,
            redact_before_buffer=redact_flag,
            redis_client=redis_client,
        )
    return InMemoryTranscriptBuffer(
        ttl_seconds=ttl,
        redact_before_buffer=redact_flag,
    )

