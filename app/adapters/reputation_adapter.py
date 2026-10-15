"""Adapter for Caller Reputation Service.

Normalizes caller reputation lookups (risk scores, inverted trust scores,
or categorical registry labels) into a standard caller_reputation_score in [0.0, 1.0].
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

from app.adapters.base import BaseSignalAdapter, NormalizedSignal
from app.schemas.risk import RiskEvidence


class ReputationScoreType(str, Enum):
    """Specifies whether the upstream provider returns a risk score or a trust score."""

    RISK = "RISK"    # 0.0 = safe, 1.0 = dangerous
    TRUST = "TRUST"  # 1.0 = trusted, 0.0 = untrusted


class ReputationStatus(str, Enum):
    """Categorical classification from telecom/community lookup registries."""

    VERIFIED_SAFE = "VERIFIED_SAFE"
    TRUSTED = "TRUSTED"
    UNKNOWN = "UNKNOWN"
    SUSPICIOUS = "SUSPICIOUS"
    SPAM = "SPAM"
    BLACKLISTED = "BLACKLISTED"
    CONFIRMED_SCAM = "CONFIRMED_SCAM"


STATUS_SCORE_MAPPING = {
    ReputationStatus.VERIFIED_SAFE: 0.05,
    ReputationStatus.TRUSTED: 0.10,
    ReputationStatus.UNKNOWN: 0.30,
    ReputationStatus.SUSPICIOUS: 0.65,
    ReputationStatus.SPAM: 0.70,
    ReputationStatus.BLACKLISTED: 0.95,
    ReputationStatus.CONFIRMED_SCAM: 0.98,
}


class RawReputationLookup(BaseModel):
    """Raw payload received from caller reputation service or TRAI/DoT database."""

    phone_number: str
    call_id: Optional[str] = None
    score_type: ReputationScoreType = ReputationScoreType.RISK
    raw_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Raw score from provider (interpretation depends on score_type)",
    )
    status: Optional[ReputationStatus] = None
    complaints_count: Optional[int] = Field(default=None, ge=0)
    is_trai_dot_flagged: Optional[bool] = None
    category: Optional[str] = Field(default=None, description="Reported category, e.g., 'Bank Impersonation'")
    provider_name: Optional[str] = "reputation_db_service"


class ReputationAdapter(BaseSignalAdapter[RawReputationLookup]):
    """Normalizes caller reputation data into a unified caller_reputation_score.

    CRITICAL CONVENTION:
    - 0.0 = Trusted or low-risk reputation
    - 1.0 = Highly suspicious / known scammer reputation

    INVERSION RULE:
    If the external provider supplies a TRUST score (where 1.0 = high trust):
        caller_reputation_score = 1.0 - trust_score
    """

    def normalize(self, raw_input: RawReputationLookup) -> NormalizedSignal:
        score: float

        if raw_input.raw_score is not None:
            if raw_input.score_type == ReputationScoreType.TRUST:
                # Explicitly invert trust score to risk score
                score = 1.0 - raw_input.raw_score
            else:
                score = raw_input.raw_score
        elif raw_input.status is not None:
            score = STATUS_SCORE_MAPPING.get(raw_input.status, 0.30)
        else:
            raise ValueError(
                "Raw reputation lookup must contain either raw_score or status."
            )

        # Elevate risk if officially flagged in TRAI/DoT database
        if raw_input.is_trai_dot_flagged:
            score = max(score, 0.85)

        # Elevate risk if high community complaints count (> 10)
        if raw_input.complaints_count is not None and raw_input.complaints_count >= 10:
            score = max(score, 0.80)

        clamped_score = max(0.0, min(1.0, round(score, 4)))

        indicators: List[str] = []
        if raw_input.is_trai_dot_flagged:
            indicators.append("Flagged in TRAI/DoT scam database")
        if raw_input.complaints_count and raw_input.complaints_count > 0:
            indicators.append(f"{raw_input.complaints_count} previous community complaints reported")
        if raw_input.category:
            indicators.append(f"Reported category: {raw_input.category}")

        evidence = RiskEvidence(
            reported_scam_category=raw_input.category,
            complaints_count=raw_input.complaints_count,
            indicators=indicators,
        )

        return NormalizedSignal(
            score=clamped_score,
            source=f"reputation:{raw_input.provider_name}",
            evidence=evidence,
        )


class MockReputationAdapter(ReputationAdapter):
    """Explicitly identified mock adapter for local testing."""

    def mock_evaluate(
        self,
        phone_number: str = "+91-9876543210",
        simulated_scenario: str = "high_risk",
    ) -> NormalizedSignal:
        """Simulate reputation service lookup deterministically."""
        if simulated_scenario == "safe":
            return self.normalize(
                RawReputationLookup(
                    phone_number=phone_number,
                    score_type=ReputationScoreType.TRUST,
                    raw_score=0.95,  # High trust -> low risk (0.05)
                    status=ReputationStatus.VERIFIED_SAFE,
                    complaints_count=0,
                )
            )
        elif simulated_scenario == "suspicious":
            return self.normalize(
                RawReputationLookup(
                    phone_number=phone_number,
                    score_type=ReputationScoreType.RISK,
                    raw_score=0.50,
                    status=ReputationStatus.SUSPICIOUS,
                    complaints_count=3,
                )
            )
        else:
            return self.normalize(
                RawReputationLookup(
                    phone_number=phone_number,
                    score_type=ReputationScoreType.RISK,
                    raw_score=0.75,
                    is_trai_dot_flagged=True,
                    complaints_count=18,
                    category="Financial KYC Fraud",
                )
            )
