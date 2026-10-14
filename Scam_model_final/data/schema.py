"""Schemas and contract definitions for Scam Model and Fusion Engine."""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field

# 6 Phishing Indicator Keys
INDICATOR_KEYS: list[str] = [
    "authority_impersonation",
    "urgency_fear",
    "payment_request",
    "info_request",
    "isolation_secrecy",
    "trust_building",
]

# Weights specified in the Teammate Integration Guide (Section 2)
INDICATOR_WEIGHTS: dict[str, float] = {
    "authority_impersonation": 0.25,
    "credential_otp_requests": 0.25,  # maps from info_request
    "payment_requests": 0.20,         # maps from payment_request
    "urgency_fear": 0.15,
    "isolation_secrecy": 0.10,
    "trust_manipulation": 0.05,       # maps from trust_building
}


class PhishingCriterionScores(BaseModel):
    authority_impersonation: float = Field(default=0.0, ge=0.0, le=1.0)
    credential_otp_requests: float = Field(default=0.0, ge=0.0, le=1.0)
    payment_requests: float = Field(default=0.0, ge=0.0, le=1.0)
    urgency_fear: float = Field(default=0.0, ge=0.0, le=1.0)
    isolation_secrecy: float = Field(default=0.0, ge=0.0, le=1.0)
    trust_manipulation: float = Field(default=0.0, ge=0.0, le=1.0)


class ConversationEvidence(BaseModel):
    bank_impersonation: bool = False
    urgency_or_fear: bool = False
    otp_or_credential_request: bool = False
    payment_request: bool = False
    isolation_tactics: bool = False
    indicators: list[str] = Field(default_factory=list)


class ConversationScamOutput(BaseModel):
    """Output contract for the conversation scam detection model, conforming to Teammate Integration Guide."""
    call_id: str = "default_call"
    conversation_scam_score: float = Field(..., ge=0.0, le=1.0)
    overall_scam_probability: float = Field(..., ge=0.0, le=1.0)
    risk_level: Literal["SAFE", "SUSPICIOUS", "HIGH_RISK"]
    criteria: PhishingCriterionScores
    evidence: ConversationEvidence
    explanation: str


class PredictRequest(BaseModel):
    """Input payload for scoring a conversation transcript or text snippet."""
    call_id: str = "call-001"
    text: str
