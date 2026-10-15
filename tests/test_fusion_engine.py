"""Unit tests for the Risk Fusion Engine core scoring and classification logic."""

import pytest
from app.core.config import Settings
from app.schemas.risk import (
    CallMetadata,
    RiskEvidence,
    RiskEvaluationRequest,
    RiskLevel,
)
from app.services.fusion_engine import RiskFusionEngine


class TestWeightedScoring:
    """Tests verifying mathematical scoring accuracy."""

    def test_default_weights_calculation(self, engine: RiskFusionEngine):
        """Verify formula: (0.50 * conv) + (0.30 * voice) + (0.20 * rep)."""
        # 0.50 * 0.85 = 0.425
        # 0.30 * 0.90 = 0.270
        # 0.20 * 0.70 = 0.140
        # Total = 0.835
        req = RiskEvaluationRequest(
            call_id="call-calc-1",
            conversation_scam_score=0.85,
            voice_spoof_score=0.90,
            caller_reputation_score=0.70,
        )
        res = engine.evaluate(req)

        assert res.final_risk_score == 0.835
        assert res.risk_level == RiskLevel.HIGH_RISK
        assert res.weighted_contributions.conversation == 0.425
        assert res.weighted_contributions.voice_authenticity == 0.270
        assert res.weighted_contributions.caller_reputation == 0.140

    def test_custom_weights(self):
        """Verify engine works with custom configured weights that sum to 1.0."""
        custom_settings = Settings(
            weight_conversation=0.40,
            weight_voice_spoof=0.40,
            weight_caller_reputation=0.20,
        )
        custom_engine = RiskFusionEngine(settings=custom_settings)

        # 0.40 * 0.50 + 0.40 * 0.50 + 0.20 * 0.50 = 0.50
        req = RiskEvaluationRequest(
            call_id="call-custom-1",
            conversation_scam_score=0.50,
            voice_spoof_score=0.50,
            caller_reputation_score=0.50,
        )
        res = custom_engine.evaluate(req)
        assert res.final_risk_score == 0.50
        assert res.risk_level == RiskLevel.SUSPICIOUS
        assert res.weights.conversation == 0.40
        assert res.weights.voice_authenticity == 0.40
        assert res.weights.caller_reputation == 0.20


class TestBoundaryValuesAndClassifications:
    """Tests verifying threshold boundaries and extreme inputs."""

    @pytest.mark.parametrize(
        "score,expected_level",
        [
            (0.00, RiskLevel.SAFE),
            (0.20, RiskLevel.SAFE),
            (0.39, RiskLevel.SAFE),
            (0.399, RiskLevel.SAFE),  # Must NOT silently round to 0.40 before classification
            (0.40, RiskLevel.SUSPICIOUS),
            (0.55, RiskLevel.SUSPICIOUS),
            (0.69, RiskLevel.SUSPICIOUS),
            (0.699, RiskLevel.SUSPICIOUS),  # Must NOT silently round to 0.70 before classification
            (0.70, RiskLevel.HIGH_RISK),
            (0.85, RiskLevel.HIGH_RISK),
            (1.00, RiskLevel.HIGH_RISK),
        ],
    )
    def test_exact_threshold_classification(
        self, engine: RiskFusionEngine, score: float, expected_level: RiskLevel
    ):
        """Test exact threshold boundaries: 0.39, 0.40, 0.69, 0.70, and continuous values."""
        # When all three scores equal `score`, the fused score is exactly `score`
        # 0.50*s + 0.30*s + 0.20*s = 1.00*s = s
        req = RiskEvaluationRequest(
            call_id=f"boundary-{score}",
            conversation_scam_score=score,
            voice_spoof_score=score,
            caller_reputation_score=score,
        )
        res = engine.evaluate(req)
        assert res.risk_level == expected_level

    def test_extreme_minimum_scores_all_zero(self, engine: RiskFusionEngine):
        """Test with all inputs at minimum (0.0)."""
        req = RiskEvaluationRequest(
            call_id="call-min",
            conversation_scam_score=0.0,
            voice_spoof_score=0.0,
            caller_reputation_score=0.0,
        )
        res = engine.evaluate(req)
        assert res.final_risk_score == 0.0
        assert res.risk_level == RiskLevel.SAFE
        assert res.weighted_contributions.conversation == 0.0
        assert res.weighted_contributions.voice_authenticity == 0.0
        assert res.weighted_contributions.caller_reputation == 0.0

    def test_extreme_maximum_scores_all_one(self, engine: RiskFusionEngine):
        """Test with all inputs at maximum (1.0)."""
        req = RiskEvaluationRequest(
            call_id="call-max",
            conversation_scam_score=1.0,
            voice_spoof_score=1.0,
            caller_reputation_score=1.0,
        )
        res = engine.evaluate(req)
        assert res.final_risk_score == 1.0
        assert res.risk_level == RiskLevel.HIGH_RISK
        assert res.weighted_contributions.conversation == 0.50
        assert res.weighted_contributions.voice_authenticity == 0.30
        assert res.weighted_contributions.caller_reputation == 0.20


class TestEvidenceAndExplanations:
    """Tests verifying evidence preservation and dynamic explanations."""

    def test_evidence_preservation(self, engine: RiskFusionEngine):
        """Verify upstream evidence flags and indicators are preserved without alteration."""
        evidence = RiskEvidence(
            bank_impersonation=True,
            urgency_or_fear=True,
            otp_or_credential_request=True,
            synthetic_voice_detected=True,
            reported_scam_category="Fake Police Arrest Threat",
            complaints_count=25,
            indicators=["Police Impersonation", "Digital Arrest Scam"],
        )
        req = RiskEvaluationRequest(
            call_id="evidence-test",
            conversation_scam_score=0.95,
            voice_spoof_score=0.80,
            caller_reputation_score=0.90,
            evidence=evidence,
        )
        res = engine.evaluate(req)

        assert res.evidence is not None
        assert res.evidence.bank_impersonation is True
        assert res.evidence.complaints_count == 25
        assert "Police Impersonation" in res.evidence.indicators
        assert "authority/bank impersonation" in res.explanation.lower()

    def test_explanation_safe_call(self, engine: RiskFusionEngine):
        """Verify explanation for SAFE calls highlights low risk across signals."""
        req = RiskEvaluationRequest(
            call_id="safe-call",
            conversation_scam_score=0.05,
            voice_spoof_score=0.10,
            caller_reputation_score=0.02,
        )
        res = engine.evaluate(req)
        assert "low risk detected" in res.explanation.lower()


class TestConfigValidation:
    """Tests verifying strict validation of weights and thresholds."""

    def test_weights_sum_less_than_one(self):
        """Reject weights summing to < 1.0."""
        with pytest.raises(ValueError, match="Fusion weights must sum to 1.00"):
            Settings(
                weight_conversation=0.40,
                weight_voice_spoof=0.30,
                weight_caller_reputation=0.20,  # sum = 0.90
            )

    def test_weights_sum_greater_than_one(self):
        """Reject weights summing to > 1.0."""
        with pytest.raises(ValueError, match="Fusion weights must sum to 1.00"):
            Settings(
                weight_conversation=0.60,
                weight_voice_spoof=0.30,
                weight_caller_reputation=0.20,  # sum = 1.10
            )

    def test_negative_weight_rejected(self):
        """Reject negative weight values."""
        with pytest.raises(Exception):
            Settings(
                weight_conversation=-0.10,
                weight_voice_spoof=0.60,
                weight_caller_reputation=0.50,
            )

    def test_invalid_threshold_ordering(self):
        """Reject thresholds where safe_max >= suspicious_min."""
        with pytest.raises(ValueError, match="Invalid threshold ordering"):
            Settings(
                threshold_safe_max=0.45,
                threshold_suspicious_min=0.40,
            )

    def test_invalid_high_risk_threshold_ordering(self):
        """Reject thresholds where suspicious_max >= high_risk_min."""
        with pytest.raises(ValueError, match="Invalid threshold ordering"):
            Settings(
                threshold_suspicious_max=0.75,
                threshold_high_risk_min=0.70,
            )
