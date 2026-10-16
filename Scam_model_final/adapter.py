"""Adapter module matching the Teammate Integration Guide contracts.

Directly bridges the neural scam model with:
- RawConversationLLMOutput / PhishingCriterionScores
- ConversationAdapter interface
- Risk Fusion Engine POST /api/v1/risk/evaluate request payloads
"""

from __future__ import annotations

from typing import Any
from .data.schema import ConversationScamOutput, PhishingCriterionScores
from .predictor import ScamPredictor


class RawConversationLLMOutput:
    """Mirrors the teammate's RawConversationLLMOutput dataclass."""

    def __init__(
        self,
        call_id: str,
        overall_scam_probability: float,
        criteria: PhishingCriterionScores | None = None,
        evidence: dict[str, Any] | None = None,
    ):
        self.call_id = call_id
        self.overall_scam_probability = overall_scam_probability
        self.criteria = criteria or PhishingCriterionScores()
        self.evidence = evidence or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "call_id": self.call_id,
            "overall_scam_probability": self.overall_scam_probability,
            "criteria": self.criteria.model_dump(),
            "evidence": self.evidence,
        }


class ConversationAdapter:
    """Adapter implementing the contract specified in Section 2 & 5 of the Integration Guide."""

    def __init__(self, predictor: ScamPredictor | None = None):
        self.predictor = predictor or ScamPredictor()

    def analyze(self, text: str, call_id: str = "call-100") -> RawConversationLLMOutput:
        """Takes raw conversation transcript, runs neural analysis, and outputs RawConversationLLMOutput."""
        res: ConversationScamOutput = self.predictor.predict_fusion(text=text, call_id=call_id)
        return RawConversationLLMOutput(
            call_id=res.call_id,
            overall_scam_probability=res.conversation_scam_score,
            criteria=res.criteria,
            evidence=res.evidence.model_dump(),
        )

    def normalize(self, raw_output: RawConversationLLMOutput) -> dict[str, Any]:
        """Normalizes and extracts the conversation signal for the RiskFusionEngine."""
        return {
            "score": raw_output.overall_scam_probability,
            "criteria": raw_output.criteria.model_dump(),
            "evidence": raw_output.evidence,
        }

    def build_fusion_payload(
        self,
        text: str,
        call_id: str = "call-001",
        voice_spoof_score: float = 0.0,
        caller_reputation_score: float = 0.0,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Builds the full POST /api/v1/risk/evaluate request payload for the teammate's engine."""
        res = self.predictor.predict_fusion(text=text, call_id=call_id)
        return {
            "call_id": call_id,
            "conversation_scam_score": res.conversation_scam_score,
            "voice_spoof_score": voice_spoof_score,
            "caller_reputation_score": caller_reputation_score,
            "source": "live_pipeline",
            "metadata": metadata or {
                "language": "Hinglish/English",
                "caller_number": "unknown",
            },
            "evidence": res.evidence.model_dump(),
        }
