"""Deterministic Risk Fusion Engine.

Combines conversation scam score, AASIST voice spoof score, and caller reputation
into an explainable final risk score and qualitative classification.
"""

from typing import List, Optional

from app.core.config import Settings, get_settings
from app.schemas.risk import (
    ComponentScores,
    RiskEvaluationRequest,
    RiskEvaluationResponse,
    RiskLevel,
    RiskWeights,
    WeightedContributions,
)
from app.services.explanation_service import ExplanationService


class RiskFusionEngine:
    """Core deterministic risk fusion engine.

    Features:
    - Pure Python calculations without external ML/cloud dependencies.
    - Configurable weights that sum to 1.00.
    - Configurable non-overlapping classification thresholds.
    - Score classification performed prior to any rounding for exact boundary accuracy.
    - Full breakdown of weighted contributions and preserved upstream evidence.
    """

    def __init__(self, settings: Optional[Settings] = None) -> None:
        """Initialize engine with application settings.

        Args:
            settings: Optional Settings instance; uses cached get_settings() if omitted.
        """
        self.settings: Settings = settings or get_settings()

    @property
    def weights(self) -> RiskWeights:
        """Return the active weights configuration."""
        return RiskWeights(
            conversation=self.settings.weight_conversation,
            voice_authenticity=self.settings.weight_voice_spoof,
            caller_reputation=self.settings.weight_caller_reputation,
        )

    def classify_risk(self, score: float) -> RiskLevel:
        """Classify a raw risk score into SAFE, SUSPICIOUS, or HIGH_RISK.

        Boundary rules:
        - score < threshold_suspicious_min (0.40): SAFE [0.00 - 0.39]
        - threshold_suspicious_min <= score < threshold_high_risk_min (0.70): SUSPICIOUS [0.40 - 0.69]
        - score >= threshold_high_risk_min: HIGH_RISK [0.70 - 1.00]

        Note: Unrounded score is evaluated to prevent silent threshold boundary drift.
        """
        if score < self.settings.threshold_suspicious_min:
            return RiskLevel.SAFE
        if score < self.settings.threshold_high_risk_min:
            return RiskLevel.SUSPICIOUS
        return RiskLevel.HIGH_RISK

    def calculate_contributions(
        self, request: RiskEvaluationRequest
    ) -> tuple[float, WeightedContributions]:
        """Compute the raw fused risk score and individual weighted contributions.

        Formula:
            final_risk = (w1 * conversation) + (w2 * voice_spoof) + (w3 * caller_reputation)

        Returns:
            Tuple of (raw_fused_score, WeightedContributions object)
        """
        w_conv = self.settings.weight_conversation
        w_voice = self.settings.weight_voice_spoof
        w_rep = self.settings.weight_caller_reputation
        prec = self.settings.score_precision_decimals

        c_conv_raw = w_conv * request.conversation_scam_score
        c_voice_raw = w_voice * request.voice_spoof_score
        c_rep_raw = w_rep * request.caller_reputation_score

        raw_fused_score = c_conv_raw + c_voice_raw + c_rep_raw

        # Ensure floating precision artifacts do not exceed [0.0, 1.0]
        clamped_score = max(0.0, min(1.0, raw_fused_score))

        contributions = WeightedContributions(
            conversation=round(c_conv_raw, prec),
            voice_authenticity=round(c_voice_raw, prec),
            caller_reputation=round(c_rep_raw, prec),
        )

        return clamped_score, contributions

    def evaluate(self, request: RiskEvaluationRequest) -> RiskEvaluationResponse:
        """Evaluate a single call request through deterministic fusion.

        Args:
            request: Validated RiskEvaluationRequest with 3 normalized scores.

        Returns:
            RiskEvaluationResponse with final score, classification, contributions, and explanation.
        """
        raw_fused_score, contributions = self.calculate_contributions(request)

        # Classify using unrounded precision score
        risk_level = self.classify_risk(raw_fused_score)

        components = ComponentScores(
            conversation_scam_score=request.conversation_scam_score,
            voice_spoof_score=request.voice_spoof_score,
            caller_reputation_score=request.caller_reputation_score,
        )

        final_score_display = round(raw_fused_score, self.settings.score_precision_decimals)

        explanation = ExplanationService.generate_explanation(
            risk_level=risk_level,
            final_risk_score=final_score_display,
            components=components,
            contributions=contributions,
            evidence=request.evidence,
        )

        return RiskEvaluationResponse(
            call_id=request.call_id,
            final_risk_score=final_score_display,
            risk_level=risk_level,
            components=components,
            weighted_contributions=contributions,
            weights=self.weights,
            evidence=request.evidence,
            explanation=explanation,
        )

    def evaluate_batch(
        self, requests: List[RiskEvaluationRequest]
    ) -> List[RiskEvaluationResponse]:
        """Evaluate a batch of independent calls sequentially and deterministically."""
        return [self.evaluate(req) for req in requests]
