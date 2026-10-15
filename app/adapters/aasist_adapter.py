"""Adapter for AASIST Voice Anti-Spoofing Model.

Normalizes AASIST model outputs (softmax probabilities, bonafide probabilities,
raw classification logits, or categorical labels) into a voice_spoof_score in [0.0, 1.0].
"""

from enum import Enum
import math
from typing import List, Optional
from pydantic import BaseModel, Field

from app.adapters.base import BaseSignalAdapter, NormalizedSignal
from app.schemas.risk import RiskEvidence


class AASISTLabel(str, Enum):
    """AASIST binary classification labels."""

    BONAFIDE = "BONAFIDE"
    SPOOF = "SPOOF"


class RawAASISTOutput(BaseModel):
    """Raw prediction payload from the AASIST inference service."""

    call_id: str
    chunk_index: Optional[int] = None
    spoof_probability: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    bonafide_probability: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    raw_logit: Optional[float] = Field(default=None, description="Raw logit prior to sigmoid/softmax")
    label: Optional[AASISTLabel] = None
    model_checkpoint: Optional[str] = "aasist_indicvoices_indicsynth_v1"


class AASISTAdapter(BaseSignalAdapter[RawAASISTOutput]):
    """Normalizes AASIST model outputs into a standard voice_spoof_score.

    Convention:
    - 0.0 = Genuine human speech (Bonafide, 0 spoof risk)
    - 1.0 = Synthetic, cloned, or voice-converted speech (High spoof risk)

    Normalization logic:
    1. If `spoof_probability` is explicitly supplied, use it directly.
    2. If only `bonafide_probability` is supplied, invert it: `spoof_score = 1.0 - bonafide_probability`.
    3. If `raw_logit` is supplied, convert via sigmoid: `1.0 / (1.0 + exp(-logit))`.
    4. If only categorical `label` is supplied:
       - BONAFIDE -> 0.05
       - SPOOF -> 0.95
    """

    def normalize(self, raw_input: RawAASISTOutput) -> NormalizedSignal:
        score: float

        if raw_input.spoof_probability is not None:
            score = raw_input.spoof_probability
        elif raw_input.bonafide_probability is not None:
            # Explicit inversion of bonafide probability to spoof risk
            score = 1.0 - raw_input.bonafide_probability
        elif raw_input.raw_logit is not None:
            # Numerically stable sigmoid function
            z = raw_input.raw_logit
            if z >= 0:
                score = 1.0 / (1.0 + math.exp(-z))
            else:
                ez = math.exp(z)
                score = ez / (1.0 + ez)
        elif raw_input.label is not None:
            score = 0.95 if raw_input.label == AASISTLabel.SPOOF else 0.05
        else:
            raise ValueError(
                "Raw AASIST output must contain at least one of: "
                "spoof_probability, bonafide_probability, raw_logit, or label."
            )

        clamped_score = max(0.0, min(1.0, round(score, 4)))
        is_synthetic = clamped_score >= 0.50

        indicators: List[str] = []
        if is_synthetic:
            indicators.append("AASIST detected synthetic/manipulated speech artifacts")

        evidence = RiskEvidence(
            synthetic_voice_detected=is_synthetic,
            spoof_confidence=clamped_score,
            indicators=indicators,
        )

        return NormalizedSignal(
            score=clamped_score,
            source=f"aasist:{raw_input.model_checkpoint or 'default'}",
            evidence=evidence,
        )


class MockAASISTAdapter(AASISTAdapter):
    """Explicitly identified mock adapter for local testing."""

    def mock_evaluate(
        self,
        call_id: str = "mock-call-001",
        simulated_scenario: str = "spoof",
    ) -> NormalizedSignal:
        """Simulate AASIST inference output deterministically."""
        if simulated_scenario == "bonafide":
            return self.normalize(
                RawAASISTOutput(
                    call_id=call_id,
                    bonafide_probability=0.96,
                    label=AASISTLabel.BONAFIDE,
                )
            )
        elif simulated_scenario == "suspicious":
            return self.normalize(
                RawAASISTOutput(
                    call_id=call_id,
                    spoof_probability=0.48,
                    raw_logit=-0.08,
                )
            )
        else:
            return self.normalize(
                RawAASISTOutput(
                    call_id=call_id,
                    spoof_probability=0.97,
                    label=AASISTLabel.SPOOF,
                )
            )
