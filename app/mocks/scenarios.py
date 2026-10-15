"""Deterministic mock scenarios for testing and demonstration.

These scenarios simulate various realistic call evaluations without requiring
running ML inference models, Azure credentials, or live databases.
NOTE: These values are deterministic synthetic mock data for development
and testing only, NOT real-time AI model predictions.
"""

from typing import Dict

from app.schemas.risk import (
    CallMetadata,
    MockScenarioName,
    RiskEvidence,
    RiskEvaluationRequest,
)

MOCK_SCENARIOS: Dict[MockScenarioName, RiskEvaluationRequest] = {
    MockScenarioName.SAFE_CALL: RiskEvaluationRequest(
        call_id="mock-safe-001",
        conversation_scam_score=0.10,
        voice_spoof_score=0.05,
        caller_reputation_score=0.08,
        source="mock",
        metadata=CallMetadata(
            language="English",
            duration_seconds=120.0,
            caller_number="+91-9876543210",
        ),
        evidence=RiskEvidence(
            bank_impersonation=False,
            urgency_or_fear=False,
            otp_or_credential_request=False,
            synthetic_voice_detected=False,
            indicators=["Verified personal contact", "Natural speech patterns"],
        ),
    ),
    MockScenarioName.SUSPICIOUS_CALL: RiskEvaluationRequest(
        call_id="mock-suspicious-002",
        conversation_scam_score=0.55,
        voice_spoof_score=0.45,
        caller_reputation_score=0.50,
        source="mock",
        metadata=CallMetadata(
            language="Hindi",
            duration_seconds=60.0,
            caller_number="+91-9123456789",
        ),
        evidence=RiskEvidence(
            urgency_or_fear=True,
            bank_impersonation=False,
            otp_or_credential_request=False,
            indicators=["Unsolicited promotional offer", "Mild urgency tactics"],
        ),
    ),
    MockScenarioName.HIGH_RISK_SCAM: RiskEvaluationRequest(
        call_id="mock-high-risk-003",
        conversation_scam_score=0.85,
        voice_spoof_score=0.90,
        caller_reputation_score=0.70,
        source="mock",
        metadata=CallMetadata(
            language="Hinglish",
            duration_seconds=45.0,
            caller_number="+91-9800012345",
        ),
        evidence=RiskEvidence(
            bank_impersonation=True,
            urgency_or_fear=True,
            otp_or_credential_request=True,
            payment_request=True,
            reported_scam_category="TRAI/DoT Flagged Financial Scam",
            complaints_count=14,
            indicators=[
                "Authority/Bank impersonation",
                "Threat of account suspension",
                "OTP credential solicitation",
                "TRAI flagged suspicious number",
            ],
        ),
    ),
    MockScenarioName.SYNTHETIC_VOICE_SCAM: RiskEvaluationRequest(
        call_id="mock-synthetic-004",
        conversation_scam_score=0.60,
        voice_spoof_score=0.98,
        caller_reputation_score=0.75,
        source="mock",
        metadata=CallMetadata(
            language="Hindi",
            duration_seconds=35.0,
            caller_number="+91-9988776655",
        ),
        evidence=RiskEvidence(
            synthetic_voice_detected=True,
            spoof_confidence=0.98,
            urgency_or_fear=True,
            indicators=[
                "AASIST deepfake voice clone detected",
                "High spectro-temporal artifact score",
                "High-risk caller reputation",
            ],
        ),
    ),
}


def get_mock_scenario(name: MockScenarioName) -> RiskEvaluationRequest:
    """Retrieve a copy of a predefined mock scenario."""
    scenario = MOCK_SCENARIOS.get(name)
    if not scenario:
        raise KeyError(f"Mock scenario '{name}' not found. Available: {[s.value for s in MockScenarioName]}")
    return scenario.model_copy(deep=True)


def list_mock_scenarios() -> Dict[str, Dict]:
    """Return catalog of available mock scenarios with descriptions."""
    descriptions = {
        MockScenarioName.SAFE_CALL.value: "Legitimate conversational call with genuine human speech and trusted caller",
        MockScenarioName.SUSPICIOUS_CALL.value: "Borderline call with mild pressure and neutral/unverified caller",
        MockScenarioName.HIGH_RISK_SCAM.value: "Classic banking impersonation scam with OTP phishing and reported number",
        MockScenarioName.SYNTHETIC_VOICE_SCAM.value: "AI voice cloning attack detected by AASIST spectro-temporal analysis",
    }
    return {
        name.value: {
            "description": descriptions[name.value],
            "sample_input": MOCK_SCENARIOS[name].model_dump(),
        }
        for name in MockScenarioName
    }
