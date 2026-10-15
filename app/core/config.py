"""Application configuration and validation.

Central configuration for Risk Fusion Engine weights, classification thresholds,
and operational policies using Pydantic Settings.
"""

from functools import lru_cache
import math
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the Risk Fusion Engine.

    All weights and thresholds are strictly validated at startup or instantiation.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Service metadata
    app_name: str = "Voice Phishing Evaluator - Risk Fusion Engine"
    app_version: str = "1.0.0"
    environment: str = "development"

    # Risk Fusion Weights (w1 + w2 + w3 = 1.00)
    weight_conversation: Annotated[float, Field(ge=0.0, le=1.0, description="Weight for conversation scam analysis")] = 0.50
    weight_voice_spoof: Annotated[float, Field(ge=0.0, le=1.0, description="Weight for AASIST voice anti-spoofing")] = 0.30
    weight_caller_reputation: Annotated[float, Field(ge=0.0, le=1.0, description="Weight for caller reputation risk score")] = 0.20

    # Risk Classification Thresholds
    # Safe: 0.00 - 0.39
    # Suspicious: 0.40 - 0.69
    # High Risk: 0.70 - 1.00
    threshold_safe_max: Annotated[float, Field(ge=0.0, le=1.0, description="Upper bound for SAFE classification")] = 0.39
    threshold_suspicious_min: Annotated[float, Field(ge=0.0, le=1.0, description="Lower bound for SUSPICIOUS classification")] = 0.40
    threshold_suspicious_max: Annotated[float, Field(ge=0.0, le=1.0, description="Upper bound for SUSPICIOUS classification")] = 0.69
    threshold_high_risk_min: Annotated[float, Field(ge=0.0, le=1.0, description="Lower bound for HIGH_RISK classification")] = 0.70

    # Missing Signal Policy
    missing_signal_policy: Literal["REJECT"] = "REJECT"

    # Batch limits
    max_batch_size: Annotated[int, Field(ge=1, le=1000)] = 100

    # Display precision
    score_precision_decimals: Annotated[int, Field(ge=2, le=6)] = 4

    @model_validator(mode="after")
    def validate_weights(self) -> "Settings":
        """Validate that weights are non-negative and sum to 1.0."""
        total_weight = (
            self.weight_conversation
            + self.weight_voice_spoof
            + self.weight_caller_reputation
        )
        if not math.isclose(total_weight, 1.0, rel_tol=1e-4, abs_tol=1e-4):
            raise ValueError(
                f"Fusion weights must sum to 1.00 (got {total_weight:.4f}). "
                f"Configured weights: conversation={self.weight_conversation}, "
                f"voice_spoof={self.weight_voice_spoof}, caller_reputation={self.weight_caller_reputation}"
            )
        return self

    @model_validator(mode="after")
    def validate_thresholds(self) -> "Settings":
        """Validate that thresholds form a valid, non-overlapping classification scheme."""
        if not (0.0 <= self.threshold_safe_max < self.threshold_suspicious_min):
            raise ValueError(
                f"Invalid threshold ordering: safe_max ({self.threshold_safe_max}) "
                f"must be strictly less than suspicious_min ({self.threshold_suspicious_min})."
            )
        if not (self.threshold_suspicious_min <= self.threshold_suspicious_max):
            raise ValueError(
                f"Invalid threshold ordering: suspicious_min ({self.threshold_suspicious_min}) "
                f"must be less than or equal to suspicious_max ({self.threshold_suspicious_max})."
            )
        if not (self.threshold_suspicious_max < self.threshold_high_risk_min <= 1.0):
            raise ValueError(
                f"Invalid threshold ordering: suspicious_max ({self.threshold_suspicious_max}) "
                f"must be strictly less than high_risk_min ({self.threshold_high_risk_min}) <= 1.0."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
