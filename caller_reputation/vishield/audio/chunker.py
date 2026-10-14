"""Audio chunking and PCM conversions for streaming ingestion."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Iterator

import numpy as np
from numpy.typing import NDArray

from vishield.domain.models import AudioChunk

MIN_CHUNK_SECONDS = 5.0
MAX_CHUNK_SECONDS = 10.0
DEFAULT_CHUNK_SECONDS = 8.0
TARGET_SAMPLE_RATE = 16_000


def float32_to_pcm16(samples: NDArray[np.float32]) -> bytes:
    """Convert float32 mono audio in [-1.0, 1.0] to 16-bit little-endian signed PCM bytes.

    Includes clipping protection against numerical overflows outside [-1.0, 1.0].
    """
    clipped = np.clip(samples, -1.0, 1.0)
    pcm16 = (clipped * 32767.0).astype(np.int16)
    return pcm16.tobytes()


def pcm16_to_float32(pcm: bytes) -> NDArray[np.float32]:
    """Convert 16-bit little-endian signed PCM bytes back to float32 mono audio."""
    if not pcm:
        return np.zeros(0, dtype=np.float32)
    pcm16 = np.frombuffer(pcm, dtype=np.int16)
    return (pcm16.astype(np.float32) / 32767.0).astype(np.float32)


def validate_chunk_seconds(chunk_seconds: float) -> None:
    if not (MIN_CHUNK_SECONDS <= chunk_seconds <= MAX_CHUNK_SECONDS):
        raise ValueError(
            f"chunk_seconds must be between {MIN_CHUNK_SECONDS} and {MAX_CHUNK_SECONDS} seconds, "
            f"got {chunk_seconds}"
        )


def iter_audio_chunks(
    samples: NDArray[np.float32],
    sample_rate: int,
    call_id: str,
    chunk_seconds: float = DEFAULT_CHUNK_SECONDS,
) -> Iterator[AudioChunk]:
    """Synchronous generator yielding AudioChunks from mono float32 audio.

    If sample_rate != 16_000, resamples to 16 kHz to satisfy the AudioChunk contract.
    Never emits an empty chunk. The final chunk may be shorter than chunk_seconds.
    """
    validate_chunk_seconds(chunk_seconds)

    if samples.ndim != 1:
        samples = samples.reshape(-1)

    if samples.size == 0:
        return

    if sample_rate != TARGET_SAMPLE_RATE:
        import librosa

        samples = librosa.resample(
            samples, orig_sr=sample_rate, target_sr=TARGET_SAMPLE_RATE
        ).astype(np.float32)
        sample_rate = TARGET_SAMPLE_RATE

    chunk_samples = int(chunk_seconds * sample_rate)
    total_samples = len(samples)

    chunk_id = 0
    for offset in range(0, total_samples, chunk_samples):
        slice_samples = samples[offset : offset + chunk_samples]
        if len(slice_samples) == 0:
            continue

        start_ms = round((offset / sample_rate) * 1000.0)
        end_ms = round(((offset + len(slice_samples)) / sample_rate) * 1000.0)
        pcm = float32_to_pcm16(slice_samples)

        yield AudioChunk(
            call_id=call_id,
            chunk_id=chunk_id,
            pcm=pcm,
            start_ms=start_ms,
            end_ms=end_ms,
        )
        chunk_id += 1


async def chunk_audio_stream(
    samples: NDArray[np.float32],
    sample_rate: int,
    call_id: str,
    chunk_seconds: float = DEFAULT_CHUNK_SECONDS,
    realtime: bool = False,
) -> AsyncIterator[AudioChunk]:
    """Async generator yielding AudioChunks from mono float32 audio.

    When ``realtime=True``, sleeps for the duration of each chunk before yielding to
    simulate a live / VoIP stream from recorded audio.
    """
    for chunk in iter_audio_chunks(samples, sample_rate, call_id, chunk_seconds):
        if realtime:
            chunk_duration_sec = (chunk.end_ms - chunk.start_ms) / 1000.0
            await asyncio.sleep(chunk_duration_sec)
        yield chunk


class AudioChunker:
    """Configurable chunker instance for streaming ingestion."""

    def __init__(self, chunk_seconds: float = DEFAULT_CHUNK_SECONDS) -> None:
        validate_chunk_seconds(chunk_seconds)
        self.chunk_seconds = chunk_seconds

    def chunk_sync(
        self, samples: NDArray[np.float32], sample_rate: int, call_id: str
    ) -> list[AudioChunk]:
        return list(iter_audio_chunks(samples, sample_rate, call_id, self.chunk_seconds))

    async def chunk_stream(
        self,
        samples: NDArray[np.float32],
        sample_rate: int,
        call_id: str,
        realtime: bool = False,
    ) -> AsyncIterator[AudioChunk]:
        async for chunk in chunk_audio_stream(
            samples, sample_rate, call_id, self.chunk_seconds, realtime=realtime
        ):
            yield chunk
