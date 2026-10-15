"""Integration tests for FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.schemas.risk import RiskLevel


class TestSystemEndpoints:
    """Tests for /health and /config endpoints."""

    def test_health_check(self, client: TestClient):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "Risk Fusion Engine" in data["service"]
        assert data["version"] == "1.0.0"

    def test_get_config(self, client: TestClient):
        response = client.get("/config")
        assert response.status_code == 200
        data = response.json()
        assert data["weights"]["conversation"] == 0.50
        assert data["weights"]["voice_authenticity"] == 0.30
        assert data["weights"]["caller_reputation"] == 0.20
        assert data["thresholds"]["safe_max"] == 0.39
        assert data["thresholds"]["suspicious_min"] == 0.40
        assert data["thresholds"]["suspicious_max"] == 0.69
        assert data["thresholds"]["high_risk_min"] == 0.70
        assert data["missing_signal_policy"] == "REJECT"


class TestEvaluateEndpoint:
    """Tests for POST /api/v1/risk/evaluate."""

    def test_evaluate_valid_call(self, client: TestClient):
        payload = {
            "call_id": "call-001",
            "conversation_scam_score": 0.85,
            "voice_spoof_score": 0.90,
            "caller_reputation_score": 0.70,
            "source": "mock",
            "metadata": {
                "language": "Hinglish",
                "duration_seconds": 45,
            },
        }
        response = client.post("/api/v1/risk/evaluate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["call_id"] == "call-001"
        assert data["final_risk_score"] == 0.835
        assert data["risk_level"] == "HIGH_RISK"
        assert data["components"]["conversation_scam_score"] == 0.85
        assert data["components"]["voice_spoof_score"] == 0.90
        assert data["components"]["caller_reputation_score"] == 0.70
        assert data["weighted_contributions"]["conversation"] == 0.425
        assert data["weighted_contributions"]["voice_authenticity"] == 0.27
        assert data["weighted_contributions"]["caller_reputation"] == 0.14
        assert "explanation" in data

    def test_reject_missing_conversation_score(self, client: TestClient):
        """Documented policy: incomplete fusion requests are strictly rejected with 422."""
        payload = {
            "call_id": "call-incomplete",
            # missing conversation_scam_score
            "voice_spoof_score": 0.90,
            "caller_reputation_score": 0.70,
        }
        response = client.post("/api/v1/risk/evaluate", json=payload)
        assert response.status_code == 422
        assert any(
            err["loc"] == ["body", "conversation_scam_score"]
            for err in response.json()["detail"]
        )

    def test_reject_missing_voice_spoof_score(self, client: TestClient):
        payload = {
            "call_id": "call-incomplete",
            "conversation_scam_score": 0.50,
            # missing voice_spoof_score
            "caller_reputation_score": 0.70,
        }
        response = client.post("/api/v1/risk/evaluate", json=payload)
        assert response.status_code == 422

    def test_reject_missing_caller_reputation_score(self, client: TestClient):
        payload = {
            "call_id": "call-incomplete",
            "conversation_scam_score": 0.50,
            "voice_spoof_score": 0.50,
            # missing caller_reputation_score
        }
        response = client.post("/api/v1/risk/evaluate", json=payload)
        assert response.status_code == 422

    def test_reject_negative_scores(self, client: TestClient):
        payload = {
            "call_id": "call-neg",
            "conversation_scam_score": -0.10,
            "voice_spoof_score": 0.50,
            "caller_reputation_score": 0.50,
        }
        response = client.post("/api/v1/risk/evaluate", json=payload)
        assert response.status_code == 422

    def test_reject_score_greater_than_one(self, client: TestClient):
        payload = {
            "call_id": "call-high",
            "conversation_scam_score": 1.15,
            "voice_spoof_score": 0.50,
            "caller_reputation_score": 0.50,
        }
        response = client.post("/api/v1/risk/evaluate", json=payload)
        assert response.status_code == 422

    def test_reject_empty_call_id(self, client: TestClient):
        payload = {
            "call_id": "",
            "conversation_scam_score": 0.50,
            "voice_spoof_score": 0.50,
            "caller_reputation_score": 0.50,
        }
        response = client.post("/api/v1/risk/evaluate", json=payload)
        assert response.status_code == 422


class TestBatchEvaluateEndpoint:
    """Tests for POST /api/v1/risk/evaluate-batch."""

    def test_batch_evaluate_success(self, client: TestClient):
        payload = {
            "calls": [
                {
                    "call_id": "call-batch-1",
                    "conversation_scam_score": 0.10,
                    "voice_spoof_score": 0.10,
                    "caller_reputation_score": 0.10,
                },
                {
                    "call_id": "call-batch-2",
                    "conversation_scam_score": 0.90,
                    "voice_spoof_score": 0.90,
                    "caller_reputation_score": 0.90,
                },
            ]
        }
        response = client.post("/api/v1/risk/evaluate-batch", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["results"]) == 2
        assert data["results"][0]["risk_level"] == "SAFE"
        assert data["results"][1]["risk_level"] == "HIGH_RISK"

    def test_batch_empty_calls_rejected(self, client: TestClient):
        payload = {"calls": []}
        response = client.post("/api/v1/risk/evaluate-batch", json=payload)
        assert response.status_code == 422

    def test_batch_exceeding_max_limit_rejected(self, client: TestClient):
        # 101 calls exceeds default max_batch_size of 100
        calls = [
            {
                "call_id": f"call-{i}",
                "conversation_scam_score": 0.5,
                "voice_spoof_score": 0.5,
                "caller_reputation_score": 0.5,
            }
            for i in range(101)
        ]
        response = client.post("/api/v1/risk/evaluate-batch", json={"calls": calls})
        assert response.status_code == 422
        assert "exceeds maximum permitted size" in response.json()["detail"]


class TestMockEvaluateEndpoints:
    """Tests for mock endpoints."""

    def test_list_mock_scenarios(self, client: TestClient):
        response = client.get("/api/v1/risk/mock-scenarios")
        assert response.status_code == 200
        catalog = response.json()
        assert "safe_call" in catalog
        assert "suspicious_call" in catalog
        assert "high_risk_scam" in catalog
        assert "synthetic_voice_scam" in catalog

    @pytest.mark.parametrize(
        "scenario_name,expected_level",
        [
            ("safe_call", "SAFE"),
            ("suspicious_call", "SUSPICIOUS"),
            ("high_risk_scam", "HIGH_RISK"),
            ("synthetic_voice_scam", "HIGH_RISK"),
        ],
    )
    def test_evaluate_mock_named_scenarios(
        self, client: TestClient, scenario_name: str, expected_level: str
    ):
        response = client.post(
            "/api/v1/risk/evaluate-mock",
            json={"scenario": scenario_name},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["risk_level"] == expected_level

    def test_evaluate_mock_with_overrides(self, client: TestClient):
        response = client.post(
            "/api/v1/risk/evaluate-mock",
            json={
                "scenario": "safe_call",
                "call_id": "custom-override-id",
                "conversation_scam_score": 0.95,  # Overriding safe score with high scam score
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["call_id"] == "custom-override-id"
        assert data["components"]["conversation_scam_score"] == 0.95

    def test_evaluate_mock_custom_scores(self, client: TestClient):
        response = client.post(
            "/api/v1/risk/evaluate-mock",
            json={
                "call_id": "custom-mock-999",
                "conversation_scam_score": 0.20,
                "voice_spoof_score": 0.20,
                "caller_reputation_score": 0.20,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["call_id"] == "custom-mock-999"
        assert data["risk_level"] == "SAFE"

    def test_evaluate_mock_missing_both_scenario_and_scores(self, client: TestClient):
        response = client.post(
            "/api/v1/risk/evaluate-mock",
            json={"call_id": "only-id"},
        )
        assert response.status_code == 422
