"""Build the configured STT backend."""

from __future__ import annotations

import logging

from vishield.config import Settings
from vishield.stt.azure_adapter import AzureStreamingSTT
from vishield.stt.base import SpeechToText
from vishield.stt.elevenlabs_adapter import ElevenLabsChunkedSTT, ElevenLabsSpeechToText
from vishield.stt.mock import MockSpeechToText, MockStreamingSTT
from vishield.stt.streaming import StreamingSpeechToText
from vishield.stt.whisper_adapter import FasterWhisperSpeechToText
from vishield.stt.whisper_chunked import WhisperChunkedSTT

log = logging.getLogger(__name__)


def _has_elevenlabs_key(settings: Settings) -> bool:
    key = settings.eleven_labs_api_key
    if key is None:
        return False
    return bool(key.get_secret_value().strip())


def build_stt(settings: Settings) -> SpeechToText:
    """Build the whole-file / batch speech-to-text backend."""
    wants_elevenlabs = settings.stt_backend == "elevenlabs" or _has_elevenlabs_key(settings)
    if wants_elevenlabs and _has_elevenlabs_key(settings):
        return ElevenLabsSpeechToText(
            api_key=settings.eleven_labs_api_key,
            model_id=settings.eleven_labs_model_id,
        )
    if wants_elevenlabs:
        log.warning("ElevenLabs requested but ELEVEN_LABS_API_KEY is missing; using mock STT.")
    if settings.stt_backend == "whisper":
        return FasterWhisperSpeechToText(
            model_size=settings.whisper_model_size, compute_type=settings.whisper_compute_type
        )
    return MockSpeechToText()


def build_streaming_stt(settings: Settings) -> StreamingSpeechToText:
    """Build the streaming speech-to-text backend."""
    if settings.stt_backend == "azure":
        candidates = [
            lang.strip()
            for lang in settings.azure_candidate_languages.split(",")
            if lang.strip()
        ]
        return AzureStreamingSTT(
            key=settings.azure_speech_key,
            region=settings.azure_speech_region,
            candidate_languages=candidates,
            chunk_seconds=settings.ingest_chunk_seconds,
            emit_empty_chunks=settings.emit_empty_chunks,
        )
    wants_elevenlabs = settings.stt_backend == "elevenlabs" or (
        _has_elevenlabs_key(settings) and settings.stt_backend != "azure"
    )
    if wants_elevenlabs and _has_elevenlabs_key(settings):
        return ElevenLabsChunkedSTT(
            api_key=settings.eleven_labs_api_key,
            model_id=settings.eleven_labs_model_id,
            emit_empty_chunks=settings.emit_empty_chunks,
        )
    if wants_elevenlabs:
        log.warning(
            "ElevenLabs streaming requested but ELEVEN_LABS_API_KEY is missing; using mock STT."
        )
    if settings.stt_backend == "whisper":
        return WhisperChunkedSTT(
            model_size=settings.whisper_model_size,
            compute_type=settings.whisper_compute_type,
            emit_empty_chunks=settings.emit_empty_chunks,
        )
    return MockStreamingSTT()

