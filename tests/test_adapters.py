"""Unit tests for signal adapters and input builder."""

import math
import pytest
from app.adapters.aasist_adapter import (
    AASISTAdapter,
    AASISTLabel,
    RawAASISTOutput,
)
from app.adapters.conversation_adapter import (
    ConversationAdapter,
    LLMScamLabel,
    PhishingCriterionScores,
    RawConversationLLMOutput,
)
from app.adapters.fusion_input_builder import build_evaluation_request
from app.adapters.reputation_adapter import (
    RawReputationLookup,
    ReputationAdapter,
    ReputationScoreType,
    ReputationStatus,
)
from app.schemas.risk import CallMetadata, RiskLevel
from app.services.fusion_engine import RiskFusionEngine


class TestReputationAdapter:
    """Tests verifying Caller Reputation normalization and Trust Score Inversion."""

    def test_trust_score_inversion(self):
        """CRITICAL: If provider returns trust score, adapter must invert: risk = 1.0 - trust."""
        adapter = ReputationAdapter()

        # Highly trusted number (trust = 0.95) -> very low risk (0.05)
        raw_trusted = RawReputationLookup(
            phone_number="+91-1111111111",
            score_type=ReputationScoreType.TRUST,
            raw_score=0.95,
        )
        signal_trusted = adapter.normalize(raw_trusted)
        assert pytest.approx(signal_trusted.score, 0.001) == 0.05

        # Untrusted / scam number (trust = 0.10) -> high risk (0.90)
        raw_untrusted = RawReputationLookup(
            phone_number="+91-9999999999",
            score_type=ReputationScoreType.TRUST,
            raw_score=0.10,
        )
        signal_untrusted = adapter.normalize(raw_untrusted)
        assert pytest.approx(signal_untrusted.score, 0.001) == 0.90

        # Boundary values
        raw_perfect_trust = RawReputationLookup(
            phone_number="+91-0000000000",
            score_type=ReputationScoreType.TRUST,
            raw_score=1.0,
        )
        assert adapter.normalize(raw_perfect_trust).score == 0.0

        raw_zero_trust = RawReputationLookup(
            phone_number="+91-0000000000",
            score_type=ReputationScoreType.TRUST,
            raw_score=0.0,
        )
        assert adapter.normalize(raw_zero_trust).score == 1.0

    def test_risk_score_passthrough(self):
        """When provider returns risk score directly, no inversion should occur."""
        adapter = ReputationAdapter()
        raw = RawReputationLookup(
            phone_number="+91-8888888888",
            score_type=ReputationScoreType.RISK,
            raw_score=0.75,
        )
        signal = adapter.normalize(raw)
        assert signal.score == 0.75

    def test_status_categorical_mapping(self):
        """Verify categorical registry status mapping."""
        adapter = ReputationAdapter()
        raw_verified = RawReputationLookup(
            phone_number="+91-123",
            status=ReputationStatus.VERIFIED_SAFE,
        )
        assert adapter.normalize(raw_verified).score == 0.05

        raw_blacklisted = RawReputationLookup(
            phone_number="+91-999",
            status=ReputationStatus.BLACKLISTED,
        )
        assert adapter.normalize(raw_blacklisted).score == 0.95

    def test_trai_dot_flagged_elevation(self):
        """Phone numbers flagged in official TRAI/DoT database are elevated in risk."""
        adapter = ReputationAdapter()
        raw = RawReputationLookup(
            phone_number="+91-8888888888",
            score_type=ReputationScoreType.RISK,
            raw_score=0.20,
            is_trai_dot_flagged=True,
        )
        signal = adapter.normalize(raw)
        assert signal.score >= 0.85
        assert "Flagged in TRAI/DoT scam database" in signal.evidence.indicators


class TestAASISTAdapter:
    """Tests verifying AASIST model output normalization."""

    def test_spoof_probability_direct(self):
        adapter = AASISTAdapter()
        raw = RawAASISTOutput(
            call_id="c1",
            spoof_probability=0.88,
        )
        signal = adapter.normalize(raw)
        assert signal.score == 0.88
        assert signal.evidence.synthetic_voice_detected is True

    def test_bonafide_probability_inversion(self):
        """When bonafide prob is given, spoof risk is 1.0 - bonafide."""
        adapter = AASISTAdapter()
        raw = RawAASISTOutput(
            call_id="c1",
            bonafide_probability=0.92,
        )
        signal = adapter.normalize(raw)
        assert pytest.approx(signal.score, 0.001) == 0.08
        assert signal.evidence.synthetic_voice_detected is False

    def test_raw_logit_sigmoid(self):
        """Verify converting raw model logits via logistic sigmoid function."""
        adapter = AASISTAdapter()

        # Logit 0.0 -> probability 0.50
        raw_zero = RawAASISTOutput(call_id="c1", raw_logit=0.0)
        assert pytest.approx(adapter.normalize(raw_zero).score, 0.001) == 0.50

        # Positive logit -> > 0.50
        raw_pos = RawAASISTOutput(call_id="c1", raw_logit=2.0)
        expected = round(1.0 / (1.0 + math.exp(-2.0)), 4)
        assert pytest.approx(adapter.normalize(raw_pos).score, 0.001) == expected

    def test_categorical_label_mapping(self):
        adapter = AASISTAdapter()
        assert adapter.normalize(RawAASISTOutput(call_id="c1", label=AASISTLabel.BONAFIDE)).score == 0.05
        assert adapter.normalize(RawAASISTOutput(call_id="c1", label=AASISTLabel.SPOOF)).score == 0.95


class TestConversationAdapter:
    """Tests verifying Conversation LLM output normalization."""

    def test_direct_scam_probability(self):
        adapter = ConversationAdapter()
        raw = RawConversationLLMOutput(
            call_id="c1",
            overall_scam_probability=0.82,
        )
        signal = adapter.normalize(raw)
        assert signal.score == 0.82

    def test_criteria_aggregation(self):
        adapter = ConversationAdapter()
        raw = RawConversationLLMOutput(
            call_id="c1",
            criteria=PhishingCriterionScores(
                authority_impersonation=0.90,
                urgency_fear=0.85,
                credential_otp_requests=0.95,
                payment_requests=0.80,
            ),
        )
        signal = adapter.normalize(raw)
        assert signal.score >= 0.85
        assert signal.evidence.bank_impersonation is True
        assert signal.evidence.otp_or_credential_request is True

    def test_categorical_label_mapping(self):
        adapter = ConversationAdapter()
        assert adapter.normalize(RawConversationLLMOutput(call_id="c1", label=LLMScamLabel.SAFE)).score == 0.10
        assert adapter.normalize(RawConversationLLMOutput(call_id="c1", label=LLMScamLabel.SUSPICIOUS)).score == 0.50
        assert adapter.normalize(RawConversationLLMOutput(call_id="c1", label=LLMScamLabel.SCAM)).score == 0.90


class TestAdapterIntegrationPipeline:
    """Tests end-to-end flow from adapter signals to fusion engine."""

    def test_full_pipeline_via_builder(self, engine: RiskFusionEngine):
        conv_adapter = ConversationAdapter()
        aasist_adapter = AASISTAdapter()
        rep_adapter = ReputationAdapter()

        # Component 1: LLM detected heavy bank impersonation and OTP request
        conv_signal = conv_adapter.normalize(
            RawConversationLLMOutput(
                call_id="call-pipeline-01",
                overall_scam_probability=0.85,
                criteria=PhishingCriterionScores(
                    authority_impersonation=0.95,
                    credential_otp_requests=0.90,
                ),
            )
        )

        # Component 2: AASIST model output with high spoof probability
        aasist_signal = aasist_adapter.normalize(
            RawAASISTOutput(
                call_id="call-pipeline-01",
                spoof_probability=0.90,
            )
        )

        # Component 3: Reputation service returns trust score = 0.30 (inverts to risk = 0.70)
        rep_signal = rep_adapter.normalize(
            RawReputationLookup(
                phone_number="+91-9876543210",
                call_id="call-pipeline-01",
                score_type=ReputationScoreType.TRUST,
                raw_score=0.30,
            )
        )

        # Assemble into RiskEvaluationRequest
        req = build_evaluation_request(
            call_id="call-pipeline-01",
            conversation_signal=conv_signal,
            voice_signal=aasist_signal,
            reputation_signal=rep_signal,
            metadata=CallMetadata(language="Hinglish", duration_seconds=50.0),
        )

        # Evaluate through RiskFusionEngine
        res = engine.evaluate(req)

        assert res.call_id == "call-pipeline-01"
        assert res.risk_level == RiskLevel.HIGH_RISK
        assert res.final_risk_score == 0.835
        assert res.evidence.bank_impersonation is True
        assert res.evidence.otp_or_credential_request is True
        assert res.evidence.synthetic_voice_detected is True
