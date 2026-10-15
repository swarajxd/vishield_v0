"""Unit tests for predefined mock scenarios."""

import pytest
from app.mocks.scenarios import (
    MOCK_SCENARIOS,
    MockScenarioName,
    get_mock_scenario,
    list_mock_scenarios,
)
from app.schemas.risk import RiskLevel
from app.services.fusion_engine import RiskFusionEngine


class TestMockScenarios:
    """Verifies deterministic properties of all predefined mock scenarios."""

    def test_mock_catalog_contents(self):
        catalog = list_mock_scenarios()
        assert len(catalog) == 4
        for name in MockScenarioName:
            assert name.value in catalog
            assert "description" in catalog[name.value]
            assert "sample_input" in catalog[name.value]

    def test_mock_scenarios_determinism(self, engine: RiskFusionEngine):
        """Repeatedly evaluating mock scenarios must yield identical deterministic results."""
        for name in MockScenarioName:
            req1 = get_mock_scenario(name)
            res1 = engine.evaluate(req1)

            req2 = get_mock_scenario(name)
            res2 = engine.evaluate(req2)

            assert res1.final_risk_score == res2.final_risk_score
            assert res1.risk_level == res2.risk_level
            assert res1.explanation == res2.explanation

    def test_safe_call_scenario(self, engine: RiskFusionEngine):
        scenario = get_mock_scenario(MockScenarioName.SAFE_CALL)
        res = engine.evaluate(scenario)
        assert res.risk_level == RiskLevel.SAFE
        assert res.final_risk_score < 0.40

    def test_suspicious_call_scenario(self, engine: RiskFusionEngine):
        scenario = get_mock_scenario(MockScenarioName.SUSPICIOUS_CALL)
        res = engine.evaluate(scenario)
        assert res.risk_level == RiskLevel.SUSPICIOUS
        assert 0.40 <= res.final_risk_score < 0.70

    def test_high_risk_scam_scenario(self, engine: RiskFusionEngine):
        scenario = get_mock_scenario(MockScenarioName.HIGH_RISK_SCAM)
        res = engine.evaluate(scenario)
        assert res.risk_level == RiskLevel.HIGH_RISK
        assert res.final_risk_score >= 0.70
        assert res.evidence.bank_impersonation is True
        assert res.evidence.otp_or_credential_request is True

    def test_synthetic_voice_scam_scenario(self, engine: RiskFusionEngine):
        scenario = get_mock_scenario(MockScenarioName.SYNTHETIC_VOICE_SCAM)
        res = engine.evaluate(scenario)
        assert res.risk_level == RiskLevel.HIGH_RISK
        assert res.final_risk_score >= 0.70
        assert res.evidence.synthetic_voice_detected is True
