"""Speech-to-text adapters behind one Protocol so backends can be swapped freely."""

from vishield.stt.azure_adapter import AzureStreamingSTT
from vishield.stt.base import SpeechToText, STTUnavailableError, Transcription
from vishield.stt.elevenlabs_adapter import ElevenLabsChunkedSTT, ElevenLabsSpeechToText
from vishield.stt.factory import build_streaming_stt, build_stt
from vishield.stt.mock import MockSpeechToText, MockStreamingSTT
from vishield.stt.streaming import RecognizedPhrase, StreamingSpeechToText
from vishield.stt.whisper_chunked import WhisperChunkedSTT

__all__ = [
    "AzureStreamingSTT",
    "ElevenLabsChunkedSTT",
    "ElevenLabsSpeechToText",
    "MockSpeechToText",
    "MockStreamingSTT",
    "RecognizedPhrase",
    "STTUnavailableError",
    "SpeechToText",
    "StreamingSpeechToText",
    "Transcription",
    "WhisperChunkedSTT",
    "build_streaming_stt",
    "build_stt",
]

