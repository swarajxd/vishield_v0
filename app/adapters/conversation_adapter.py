"""Adapter for Conversation Analysis Component (Azure AI Speech + LLM Foundry).

Normalizes raw LLM predictions, criterion scores, or categorical scam labels
into a unified conversation_scam_score in [0.0, 1.0] and extracts structured evidence.
"""

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.adapters.base import BaseSignalAdapter, NormalizedSignal
from app.schemas.risk import RiskEvidence


class LLMScamLabel(str, Enum):
    """Categorical output labels that an LLM analysis prompt may return."""

    SAFE = "SAFE"
    BENIGN = "BENIGN"
    SUSPICIOUS = "SUSPICIOUS"
    SCAM = "SCAM"
    FRAUD = "FRAUD"


LABEL_SCORE_MAPPING: Dict[LLMScamLabel, float] = {
    LLMScamLabel.SAFE: 0.10,
    LLMScamLabel.BENIGN: 0.10,
    LLMScamLabel.SUSPICIOUS: 0.50,
    LLMScamLabel.SCAM: 0.90,
    LLMScamLabel.FRAUD: 0.95,
}


class PhishingCriterionScores(BaseModel):
    """Criterion-wise scores evaluated by the Azure AI Foundry LLM (0.0 to 1.0 each).

    As described in Section 3.2 of the system architecture:
    1. Authority or bank/government impersonation
    2. Urgency and fear tactics
    3. Payment or money requests
    4. Requests for OTP, PIN, CVV, password
    5. Isolation or secrecy instructions
    6. Trust building and social manipulation
    """

    authority_impersonation: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    urgency_fear: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    payment_requests: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    credential_otp_requests: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    isolation_secrecy: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    trust_manipulation: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class RawConversationLLMOutput(BaseModel):
    """Contract representing the raw payload received from Azure AI Foundry LLM."""

    call_id: str
    transcript: Optional[str] = None
    overall_scam_probability: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    label: Optional[LLMScamLabel] = None
    criteria: Optional[PhishingCriterionScores] = None
    extracted_indicators: List[str] = Field(default_factory=list)
    model_version: Optional[str] = "gpt-4o-azure-foundry"


class ConversationAdapter(BaseSignalAdapter[RawConversationLLMOutput]):
    """Normalizes raw LLM output into a 0.0-1.0 risk score and structured evidence.

    Integration Assumptions:
    1. 0.0 means completely benign conversation; 1.0 means high-confidence scam.
    2. If `overall_scam_probability` is provided directly, it is used directly after bounds validation.
    3. If only `criteria` are provided, the adapter calculates a weighted aggregation
       where high-severity signals (OTP/credentials, authority impersonation) carry more weight.
    4. If only categorical `label` is provided, deterministic mapping is applied:
       - SAFE / BENIGN -> 0.10
       - SUSPICIOUS -> 0.50
       - SCAM / FRAUD -> 0.90 / 0.95
    """

    def normalize(self, raw_input: RawConversationLLMOutput) -> NormalizedSignal:
        score: float

        if raw_input.overall_scam_probability is not None:
            score = raw_input.overall_scam_probability
        elif raw_input.criteria is not None:
            score = self._aggregate_criteria(raw_input.criteria)
        elif raw_input.label is not None:
            score = LABEL_SCORE_MAPPING.get(raw_input.label, 0.50)
        else:
            raise ValueError(
                "Raw conversation LLM output must provide at least one of: "
                "overall_scam_probability, criteria, or label."
            )

        # Build structured evidence from criteria and tags
        evidence = self._build_evidence(raw_input)

        return NormalizedSignal(
            score=max(0.0, min(1.0, round(score, 4))),
            source=f"azure_llm:{raw_input.model_version or 'unknown'}",
            evidence=evidence,
        )

    def _aggregate_criteria(self, criteria: PhishingCriterionScores) -> float:
        """Aggregate individual criteria into a composite scam score."""
        weights = {
            "credential_otp_requests": 0.25,
            "authority_impersonation": 0.25,
            "payment_requests": 0.20,
            "urgency_fear": 0.15,
            "isolation_secrecy": 0.10,
            "trust_manipulation": 0.05,
        }

        weighted_sum = 0.0
        weight_total = 0.0

        for field_name, w in weights.items():
            val = getattr(criteria, field_name)
            if val is not None:
                weighted_sum += val * w
                weight_total += w

        if weight_total == 0.0:
            return 0.0

        # Max criterion risk boost: if any critical criterion is high (>=0.85),
        # prevent it from being diluted by benign scores.
        crit_vals = [getattr(criteria, f) for f in weights.keys() if getattr(criteria, f) is not None]
        max_val = max(crit_vals) if crit_vals else 0.0

        raw_score = (weighted_sum / weight_total) * 0.70 + (max_val * 0.30)
        return min(1.0, raw_score)

    def _build_evidence(self, raw_input: RawConversationLLMOutput) -> RiskEvidence:
        indicators = list(raw_input.extracted_indicators)

        crit = raw_input.criteria
        bank_imp = (crit.authority_impersonation >= 0.50) if (crit and crit.authority_impersonation is not None) else False
        urgency = (crit.urgency_fear >= 0.50) if (crit and crit.urgency_fear is not None) else False
        otp_req = (crit.credential_otp_requests >= 0.50) if (crit and crit.credential_otp_requests is not None) else False
        payment = (crit.payment_requests >= 0.50) if (crit and crit.payment_requests is not None) else False
        isolation = (crit.isolation_secrecy >= 0.50) if (crit and crit.isolation_secrecy is not None) else False

        if bank_imp and "Authority impersonation" not in indicators:
            indicators.append("Authority/Bank impersonation")
        if urgency and "Urgency tactics" not in indicators:
            indicators.append("Urgency/Fear tactics")
        if otp_req and "OTP request" not in indicators:
            indicators.append("OTP/Credential solicitation")

        return RiskEvidence(
            bank_impersonation=bank_imp,
            urgency_or_fear=urgency,
            otp_or_credential_request=otp_req,
            payment_request=payment,
            isolation_tactics=isolation,
            indicators=indicators,
        )


class MockConversationAdapter(ConversationAdapter):
    """Explicitly identified mock adapter for local testing."""

    def mock_evaluate(
        self,
        call_id: str = "mock-call-001",
        simulated_scenario: str = "high_risk",
    ) -> NormalizedSignal:
        """Generate a simulated normalized signal for testing without calling Azure Foundry."""
        if simulated_scenario == "safe":
            return self.normalize(
                RawConversationLLMOutput(
                    call_id=call_id,
                    overall_scam_probability=0.10,
                    label=LLMScamLabel.SAFE,
                    extracted_indicators=["Casual conversation"],
                )
            )
        elif simulated_scenario == "suspicious":
            return self.normalize(
                RawConversationLLMOutput(
                    call_id=call_id,
                    overall_scam_probability=0.55,
                    label=LLMScamLabel.SUSPICIOUS,
                    criteria=PhishingCriterionScores(urgency_fear=0.60, trust_manipulation=0.50),
                    extracted_indicators=["Unsolicited offer"],
                )
            )
        else:
            return self.normalize(
                RawConversationLLMOutput(
                    call_id=call_id,
                    overall_scam_probability=0.88,
                    label=LLMScamLabel.SCAM,
                    criteria=PhishingCriterionScores(
                        authority_impersonation=0.95,
                        urgency_fear=0.90,
                        credential_otp_requests=0.95,
                        payment_requests=0.80,
                    ),
                    extracted_indicators=["Fake bank manager", "Urgent KYC update required"],
                )
            )
