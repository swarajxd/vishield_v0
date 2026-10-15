"""Pydantic schemas for the Risk Fusion Engine.

Defines strict input contracts, output contracts, metadata, evidence structures,
batch evaluation schemas, and system configuration representations.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class RiskLevel(str, Enum):
    """Classification levels for fused risk scores."""

    SAFE = "SAFE"
    SUSPICIOUS = "SUSPICIOUS"
    HIGH_RISK = "HIGH_RISK"


class MockScenarioName(str, Enum):
    """Predefined mock scenarios for testing and demonstration."""

    SAFE_CALL = "safe_call"
    SUSPICIOUS_CALL = "suspicious_call"
    HIGH_RISK_SCAM = "high_risk_scam"
    SYNTHETIC_VOICE_SCAM = "synthetic_voice_scam"


class CallMetadata(BaseModel):
    """Optional metadata accompanying the call evaluation request."""

    model_config = ConfigDict(extra="allow")

    language: Optional[str] = Field(
        default=None,
        description="Spoken language identified (e.g., Hindi, English, Hinglish)",
        examples=["Hinglish"],
    )
    duration_seconds: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Call or chunk duration in seconds",
        examples=[45.0],
    )
    caller_number: Optional[str] = Field(
        default=None,
        description="Caller phone number (raw or masked)",
        examples=["+91-9876543210"],
    )
    audio_format: Optional[str] = Field(
        default=None,
        description="Audio format or encoding (e.g., wav, pcm_16k)",
    )
    timestamp: Optional[datetime] = Field(
        default=None,
        description="Call event timestamp",
    )


class RiskEvidence(BaseModel):
    """Structured evidence optionally supplied by upstream components.

    Preserved transparently in the response without pretending the fusion engine
    independently detected it.
    """

    model_config = ConfigDict(extra="allow")

    bank_impersonation: Optional[bool] = Field(
        default=None,
        description="Whether bank, police, or authority impersonation was detected by conversation LLM",
    )
    urgency_or_fear: Optional[bool] = Field(
        default=None,
        description="Whether urgency, threat of arrest, or account block fear tactics were detected",
    )
    otp_or_credential_request: Optional[bool] = Field(
        default=None,
        description="Whether request for OTP, PIN, CVV, or passwords was detected",
    )
    payment_request: Optional[bool] = Field(
        default=None,
        description="Whether immediate UPI or money transfer was solicited",
    )
    isolation_tactics: Optional[bool] = Field(
        default=None,
        description="Whether secrecy or isolation commands were detected",
    )
    synthetic_voice_detected: Optional[bool] = Field(
        default=None,
        description="Whether AASIST detected synthetic speech / AI voice cloning",
    )
    spoof_confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Raw confidence score from AASIST model",
    )
    reported_scam_category: Optional[str] = Field(
        default=None,
        description="Scam category from caller reputation database (e.g., TRAI/DoT flagged)",
    )
    complaints_count: Optional[int] = Field(
        default=None,
        ge=0,
        description="Number of previous community reports for caller number",
    )
    indicators: List[str] = Field(
        default_factory=list,
        description="Summary list of human-readable indicator tags",
    )


class RiskEvaluationRequest(BaseModel):
    """Input contract for evaluating the risk of a single call.

    Requires three normalized scores in [0.0, 1.0]. Missing scores are rejected.
    """

    model_config = ConfigDict(extra="forbid")

    call_id: str = Field(
        ...,
        min_length=1,
        description="Unique identifier for the call",
        examples=["call-001"],
    )
    conversation_scam_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Normalized conversation scam risk (0.0=safe, 1.0=scam)",
        examples=[0.85],
    )
    voice_spoof_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Normalized voice spoof risk from AASIST (0.0=bonafide human, 1.0=synthetic/spoof)",
        examples=[0.90],
    )
    caller_reputation_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Normalized caller reputation risk (0.0=trusted/verified, 1.0=known scammer)",
        examples=[0.70],
    )
    source: Optional[str] = Field(
        default="direct",
        description="Signal source identifier (e.g., 'mock', 'azure_llm', 'aasist', 'reputation_service')",
        examples=["mock"],
    )
    metadata: Optional[CallMetadata] = Field(
        default=None,
        description="Optional call metadata",
    )
    evidence: Optional[RiskEvidence] = Field(
        default=None,
        description="Optional upstream evidence and indicator flags",
    )


class ComponentScores(BaseModel):
    """Normalized input scores across the three independent signals."""

    conversation_scam_score: float = Field(..., ge=0.0, le=1.0)
    voice_spoof_score: float = Field(..., ge=0.0, le=1.0)
    caller_reputation_score: float = Field(..., ge=0.0, le=1.0)


class WeightedContributions(BaseModel):
    """Individual weighted contributions (score * weight) of each component."""

    conversation: float = Field(..., description="Contribution from conversation analysis (0.50 * score)")
    voice_authenticity: float = Field(..., description="Contribution from voice anti-spoofing (0.30 * score)")
    caller_reputation: float = Field(..., description="Contribution from caller reputation (0.20 * score)")


class RiskWeights(BaseModel):
    """Weights applied to each component during fusion."""

    conversation: float = Field(..., description="Configured weight for conversation scam score")
    voice_authenticity: float = Field(..., description="Configured weight for voice spoof score")
    caller_reputation: float = Field(..., description="Configured weight for caller reputation score")


class RiskEvaluationResponse(BaseModel):
    """Standardized response contract for a fused risk evaluation."""

    call_id: str = Field(..., description="Unique call identifier")
    final_risk_score: float = Field(..., ge=0.0, le=1.0, description="Calculated fused risk score")
    risk_level: RiskLevel = Field(..., description="Qualitative classification: SAFE, SUSPICIOUS, or HIGH_RISK")
    components: ComponentScores = Field(..., description="Normalized input scores")
    weighted_contributions: WeightedContributions = Field(..., description="Weighted contribution per component")
    weights: RiskWeights = Field(..., description="Weights used in scoring")
    evidence: Optional[RiskEvidence] = Field(default=None, description="Upstream evidence preserved from request")
    explanation: str = Field(..., description="Concise dynamic explanation of the risk determination")


class BatchRiskEvaluationRequest(BaseModel):
    """Request contract for evaluating multiple calls in a single batch."""

    calls: List[RiskEvaluationRequest] = Field(
        ...,
        min_length=1,
        description="List of individual call evaluation requests",
    )


class BatchRiskEvaluationResponse(BaseModel):
    """Response contract for a batch evaluation."""

    total: int = Field(..., description="Number of evaluated calls")
    results: List[RiskEvaluationResponse] = Field(..., description="Evaluation results for each call")


class MockEvaluationRequest(BaseModel):
    """Request contract for the mock evaluation endpoint.

    Can specify either a predefined scenario name or explicit mock scores.
    """

    model_config = ConfigDict(extra="forbid")

    scenario: Optional[MockScenarioName] = Field(
        default=None,
        description="Named predefined scenario: 'safe_call', 'suspicious_call', 'high_risk_scam', 'synthetic_voice_scam'",
        examples=["high_risk_scam"],
    )
    call_id: Optional[str] = Field(
        default=None,
        description="Optional custom call ID override",
    )
    conversation_scam_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Optional override for conversation scam score",
    )
    voice_spoof_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Optional override for voice spoof score",
    )
    caller_reputation_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Optional override for caller reputation score",
    )
    metadata: Optional[CallMetadata] = Field(
        default=None,
        description="Optional metadata override",
    )
    evidence: Optional[RiskEvidence] = Field(
        default=None,
        description="Optional evidence override",
    )


class ThresholdsConfig(BaseModel):
    """Active risk classification thresholds."""

    safe_max: float = Field(..., description="Scores <= 0.39 are SAFE")
    suspicious_min: float = Field(..., description="Scores >= 0.40 are SUSPICIOUS")
    suspicious_max: float = Field(..., description="Scores <= 0.69 are SUSPICIOUS")
    high_risk_min: float = Field(..., description="Scores >= 0.70 are HIGH_RISK")


class EngineConfigResponse(BaseModel):
    """Response contract for GET /config returning active weights and thresholds."""

    app_name: str
    app_version: str
    weights: RiskWeights
    thresholds: ThresholdsConfig
    missing_signal_policy: str
    policy_description: str


class HealthResponse(BaseModel):
    """Response contract for GET /health."""

    status: str
    service: str
    version: str
