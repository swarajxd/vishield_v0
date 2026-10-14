"""Streaming STT adapter using Azure AI Speech with continuous language identification.

Documentation references:
- Azure Speech SDK Automatic Language Detection:
  https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-automatic-language-detection?pivots=programming-language-python
- Azure Speech SDK Continuous Recognition:
  https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-recognize-speech?pivots=programming-language-python
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator, Callable
from typing import Any

from pydantic import SecretStr

from vishield.domain.models import AudioChunk, TranscriptChunk
from vishield.stt.base import STTUnavailableError
from vishield.stt.chunk_mapper import PhraseToChunkMapper
from vishield.stt.streaming import RecognizedPhrase

log = logging.getLogger(__name__)


class AzureStreamingSTT:
    """Persistent streaming recognizer for a single call session.

    Architecture highlights:
    - One persistent SpeechRecognizer per call with a PushAudioInputStream.
    - Continuous language identification configured for ["hi-IN", "en-IN"] using v2 endpoint.
    - Audio is pushed continuously without per-chunk reconnections, avoiding boundary clipping.
    - Mappings from audio offset (100-ns ticks) to chunk_id (offset_ms // chunk_ms).
    - Phrases straddling chunk boundaries are assigned to the chunk where they start.
    - Multiple phrases in a chunk are merged into one TranscriptChunk.
    - Silent chunks emit nothing by default, or empty chunk when emit_empty_chunks is True.
    - Never logs audio samples, transcripts, or secrets.
    """

    name = "azure"

    def __init__(
        self,
        key: SecretStr | None = None,
        region: str | None = None,
        candidate_languages: list[str] | None = None,
        chunk_seconds: float = 8.0,
        emit_empty_chunks: bool = False,
        max_retries: int = 3,
        backoff_seconds: float = 0.5,
        recognizer_factory: Callable[..., Any] | None = None,
    ) -> None:
        self.key = key
        self.region = region
        self.candidate_languages = candidate_languages or ["hi-IN", "en-IN"]
        self.chunk_seconds = chunk_seconds
        self.emit_empty_chunks = emit_empty_chunks
        self.max_retries = max_retries
        self.backoff_seconds = backoff_seconds
        self._recognizer_factory = recognizer_factory

        self.call_id: str = ""
        self.mapper: PhraseToChunkMapper | None = None
        self._recognizer: Any = None
        self._push_stream: Any = None
        self._loop: asyncio.AbstractEventLoop | None = None

        self._phrases_queue: asyncio.Queue[RecognizedPhrase | None] = asyncio.Queue()
        self._chunks_queue: asyncio.Queue[TranscriptChunk | None] = asyncio.Queue()
        self._history: list[TranscriptChunk] = []
        self._phrase_history: list[RecognizedPhrase] = []
        self._finished = False
        self._error: Exception | None = None

    def _ensure_sdk_and_credentials(self) -> Any:
        if self._recognizer_factory is not None:
            return None

        if not self.key or not self.key.get_secret_value():
            raise STTUnavailableError(
                "stt_unavailable: Azure Speech subscription key is not configured. "
                "Set VISHIELD_AZURE_SPEECH_KEY or use mock/whisper backend."
            )

        if not self.region:
            raise STTUnavailableError(
                "stt_unavailable: Azure Speech region is not configured. "
                "Set VISHIELD_AZURE_SPEECH_REGION or use mock/whisper backend."
            )

        try:
            import azure.cognitiveservices.speech as speechsdk
        except ImportError as exc:
            raise STTUnavailableError(
                "Azure Cognitive Services Speech SDK is not installed. "
                "Install it with `pip install -e '.[azure]'` or set VISHIELD_STT_BACKEND=mock."
            ) from exc

        return speechsdk


    async def start(self, call_id: str) -> None:
        self.call_id = call_id
        self.mapper = PhraseToChunkMapper(
            call_id=call_id,
            chunk_seconds=self.chunk_seconds,
            emit_empty_chunks=self.emit_empty_chunks,
        )
        self._phrases_queue = asyncio.Queue()
        self._chunks_queue = asyncio.Queue()
        self._history = []
        self._phrase_history = []
        self._finished = False
        self._error = None
        self._loop = asyncio.get_running_loop()

        speechsdk = self._ensure_sdk_and_credentials()

        if self._recognizer_factory is not None:
            self._recognizer, self._push_stream = self._recognizer_factory(
                call_id=call_id,
                on_recognized=self._on_recognized_callback,
                on_canceled=self._on_canceled_callback,
            )
            return

        # Real Azure SDK initialization
        # Setup 16 kHz 16-bit mono stream format
        stream_format = speechsdk.audio.AudioStreamFormat(
            samples_per_second=16000, bits_per_sample=16, channels=1
        )
        self._push_stream = speechsdk.audio.PushAudioInputStream(stream_format=stream_format)
        audio_config = speechsdk.audio.AudioConfig(stream=self._push_stream)

        secret_key_val = self.key.get_secret_value() if self.key else ""
        speech_config = speechsdk.SpeechConfig(subscription=secret_key_val, region=self.region)

        # Configure Continuous LID and v2 endpoint
        # Ref: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-automatic-language-detection
        auto_detect_config = speechsdk.languageconfig.AutoDetectSourceLanguageConfig(
            languages=self.candidate_languages
        )
        with contextlib.suppress(Exception):
            speech_config.set_property(
                speechsdk.PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous"
            )
        speech_config.set_property_by_name(
            "SpeechServiceConnection_ContinuousLanguageIdPriority", "Accuracy"
        )
        speech_config.set_property_by_name("SpeechServiceConnection_UseV2Endpoint", "true")

        self._recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config,
            audio_config=audio_config,
            auto_detect_source_language_config=auto_detect_config,
        )

        self._recognizer.recognized.connect(self._handle_recognized_event)
        self._recognizer.canceled.connect(self._handle_canceled_event)
        self._recognizer.start_continuous_recognition_async()

    def _handle_recognized_event(self, evt: Any) -> None:
        try:
            import azure.cognitiveservices.speech as speechsdk

            if evt.result.reason == speechsdk.ResultReason.RecognizedSpeech:
                text = evt.result.text.strip()
                if not text:
                    return

                # Convert ticks (100 ns) to ms: 1 tick = 0.0001 ms -> ticks // 10_000
                offset_ms = int(evt.result.offset // 10_000)
                duration_ms = int(evt.result.duration // 10_000)

                # Extract detected language
                auto_detect_res = speechsdk.AutoDetectSourceLanguageResult(evt.result)
                lang = getattr(auto_detect_res, "language", "") or "en-IN"

                self._on_recognized_callback(text, lang, offset_ms, duration_ms)
        except Exception as exc:
            log.warning("Error processing Azure recognized event: %s", exc.__class__.__name__)

    def _handle_canceled_event(self, evt: Any) -> None:
        try:
            import azure.cognitiveservices.speech as speechsdk

            details = speechsdk.CancellationDetails(evt.result)
            error_code = str(getattr(details, "error_code", ""))
            error_details = str(getattr(details, "error_details", ""))
            self._on_canceled_callback(details.reason, error_code, error_details)
        except Exception as exc:
            log.warning("Error processing Azure cancellation event: %s", exc.__class__.__name__)

    def _on_recognized_callback(
        self, text: str, lang: str, offset_ms: int, duration_ms: int
    ) -> None:
        phrase = RecognizedPhrase(
            text=text,
            language=lang,
            offset_ms=offset_ms,
            duration_ms=duration_ms,
        )
        self._phrase_history.append(phrase)
        if self.mapper is not None:
            self.mapper.add_phrase(phrase)

        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._phrases_queue.put_nowait, phrase)
        else:
            self._phrases_queue.put_nowait(phrase)

    def _on_canceled_callback(self, reason: Any, error_code: str, error_details: str) -> None:
        # Check authentication / bad key error
        if "Authentication" in str(error_code) or "Authentication" in error_details:
            self._error = STTUnavailableError(
                "stt_unavailable: Azure authentication failed. Bad key or invalid region."
            )
        else:
            self._error = STTUnavailableError(
                f"stt_session_failed: Azure Speech session canceled ({error_code})."
            )

    async def push(self, chunk: AudioChunk) -> None:
        if self._error is not None:
            raise self._error

        if self.mapper is not None:
            self.mapper.note_chunk_pushed(chunk.chunk_id)

        if self._push_stream is not None:
            # push raw 16-bit PCM bytes
            try:
                self._push_stream.write(chunk.pcm)
            except Exception as exc:
                raise STTUnavailableError(
                    f"stt_session_failed: Failed to push PCM bytes to Azure stream: {exc}"
                ) from exc

    async def finish(self) -> None:
        if self._error is not None:
            raise self._error

        if self._push_stream is not None:
            with contextlib.suppress(Exception):
                self._push_stream.close()

        has_stop = self._recognizer is not None and hasattr(
            self._recognizer, "stop_continuous_recognition_async"
        )
        if has_stop:
            with contextlib.suppress(Exception):
                # Allow a short period for in-flight recognition completion
                await asyncio.sleep(0.05)
                self._recognizer.stop_continuous_recognition_async()

        # Build final consolidated TranscriptChunks from all chunks observed
        if self.mapper is not None:
            built_chunks = self.mapper.build_all_chunks()
            for chunk in built_chunks:
                self._history.append(chunk)
                await self._chunks_queue.put(chunk)

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
