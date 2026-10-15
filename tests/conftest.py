"""Pytest fixtures and test configurations."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app
from app.schemas.risk import RiskEvaluationRequest, RiskEvidence, CallMetadata
from app.services.fusion_engine import RiskFusionEngine


@pytest.fixture
def default_settings() -> Settings:
    """Return standard default settings."""
    return Settings(
        weight_conversation=0.50,
        weight_voice_spoof=0.30,
        weight_caller_reputation=0.20,
        threshold_safe_max=0.39,
        threshold_suspicious_min=0.40,
        threshold_suspicious_max=0.69,
        threshold_high_risk_min=0.70,
    )


@pytest.fixture
def engine(default_settings: Settings) -> RiskFusionEngine:
    """Return an initialized RiskFusionEngine with default settings."""
    return RiskFusionEngine(settings=default_settings)


@pytest.fixture
def client() -> TestClient:
    """Return a FastAPI TestClient."""
    return TestClient(app)


@pytest.fixture
def sample_high_risk_request() -> RiskEvaluationRequest:
    """Return a standard high risk request payload."""
    return RiskEvaluationRequest(
        call_id="call-001",
        conversation_scam_score=0.85,
        voice_spoof_score=0.90,
        caller_reputation_score=0.70,
        source="mock",
        metadata=CallMetadata(
            language="Hinglish",
            duration_seconds=45.0,
            caller_number="+91-9876543210",
        ),
        evidence=RiskEvidence(
            bank_impersonation=True,
            urgency_or_fear=True,
            otp_or_credential_request=True,
            synthetic_voice_detected=True,
            indicators=["Urgent KYC demand", "OTP request"],
        ),
    )


@pytest.fixture
def sample_safe_request() -> RiskEvaluationRequest:
    """Return a standard safe request payload."""
    return RiskEvaluationRequest(
        call_id="call-safe-001",
        conversation_scam_score=0.10,
        voice_spoof_score=0.15,
        caller_reputation_score=0.05,
        source="mock",
        metadata=CallMetadata(
            language="English",
            duration_seconds=120.0,
        ),
    )
