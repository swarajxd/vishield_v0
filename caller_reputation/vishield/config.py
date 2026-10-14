"""Central configuration loaded from environment variables / .env.

Everything tunable lives here so no module hard-codes paths, limits or weights.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

RANDOM_SEED = 42
"""Deterministic seed used by every split, training and sampling routine."""

_BACKEND_ENV = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    """Runtime settings. Prefix every environment variable with ``VISHIELD_``."""

    model_config = SettingsConfigDict(
        env_prefix="VISHIELD_",
        env_file=(_BACKEND_ENV, ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    env: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"

    # Upload limits
    max_file_mb: float = Field(default=10.0, gt=0, le=200)
    max_duration_seconds: float = Field(default=180.0, gt=0, le=3600)
    min_duration_seconds: float = Field(default=1.0, ge=0)
    allowed_mime_types: tuple[str, ...] = (
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/mpeg",
        "audio/mp3",
        "audio/mp4",
        "audio/x-m4a",
        "audio/m4a",
    )
    allowed_extensions: tuple[str, ...] = (".wav", ".mp3", ".m4a")
    target_sample_rate: int = 16_000

    # Ingestion & Streaming Speech-to-Text
    ingest_chunk_seconds: float = Field(default=8.0, ge=5.0, le=10.0)
    ingest_realtime_default: bool = False
    ingest_redact_before_buffer: bool = True
    emit_empty_chunks: bool = False

    # Speech to text
    stt_backend: Literal["mock", "whisper", "azure", "elevenlabs"] = "elevenlabs"
    whisper_model_size: str = "base"
    whisper_compute_type: str = "int8"

    # ElevenLabs Scribe (speech-to-text)
    eleven_labs_api_key: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "VISHIELD_ELEVEN_LABS_API_KEY",
            "ELEVEN_LABS_API_KEY",
            "ELEVENLABS_API_KEY",
        ),
    )
    eleven_labs_model_id: str = Field(
        default="scribe_v1",
        validation_alias=AliasChoices(
            "VISHIELD_ELEVEN_LABS_MODEL_ID",
            "ELEVEN_LABS_MODEL_ID",
        ),
    )

    # Azure AI Speech (streaming STT)
    azure_speech_key: SecretStr | None = None
    azure_speech_region: str | None = None
    azure_candidate_languages: str = "hi-IN,en-IN"

    # Transcript buffer
    transcript_buffer_backend: Literal["memory", "redis"] = "memory"
    redis_url: str = "redis://localhost:6379/0"
    transcript_ttl_seconds: int = Field(default=3600, gt=0)


    # Risk engine
    weight_rules: float = Field(default=0.4, ge=0, le=1)
    weight_ml: float = Field(default=0.5, ge=0, le=1)
    weight_acoustic: float = Field(default=0.1, ge=0, le=1)
    risk_medium_threshold: int = Field(default=35, ge=1, le=99)
    risk_high_threshold: int = Field(default=65, ge=2, le=100)
    rule_saturation_weight: float = Field(default=3.0, gt=0)

    # Experimental
    enable_synthetic_voice_signal: bool = False
    enable_transformer_classifier: bool = False

    # Persistence
    database_url: str = "sqlite:///./vishield.db"
    model_path: Path = Path("models/tfidf_logreg.joblib")
    dataset_path: Path = Path("data/starter_dataset.jsonl")
    splits_dir: Path = Path("data/splits")

    # Development-only raw audio retention. Default OFF.
    dev_store_audio: bool = False
    dev_audio_dir: Path = Path("data/dev_audio")

    # Dashboard
    api_base_url: str = "http://localhost:8000"

    @field_validator("risk_high_threshold")
    @classmethod
    def _high_above_medium(cls, value: int, info: object) -> int:
        data = getattr(info, "data", {})
        medium = data.get("risk_medium_threshold", 35)
        if value <= medium:
            raise ValueError("risk_high_threshold must be greater than risk_medium_threshold")
        return value

    @property
    def max_file_bytes(self) -> int:
        return int(self.max_file_mb * 1024 * 1024)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide settings singleton."""
    return Settings()


def reset_settings_cache() -> None:
    """Clear the cached settings (used by tests that mutate the environment)."""
    get_settings.cache_clear()
