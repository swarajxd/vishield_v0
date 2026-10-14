"""Tests for ElevenLabs Scribe STT status, token, transcribe, and redaction endpoints."""

from __future__ import annotations

import io
from collections.abc import Iterator
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from tests.audio_fixtures import synthetic_speechlike, wav_bytes
from vishield.config import Settings, reset_settings_cache
from vishield.domain.redaction import redact
from vishield.domain.rules import detect_hits
from vishield.services.analyzer import AnalysisService
from vishield.services.ingestion import IngestionService
from vishield.stt.mock import MockSpeechToText, MockStreamingSTT


@pytest.fixture
def test_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    reset_settings_cache()
    settings = Settings(
        _env_file=None,
        database_url="sqlite://",
        stt_backend="elevenlabs",
        eleven_labs_api_key="test-elevenlabs-key-12345",
        stt_allow_mock=False,
    )
    from app.main import app

    app.state.service = AnalysisService(settings=settings, stt=MockSpeechToText(), load_model=False)
    app.state.ingestion_service = IngestionService(settings=settings, stt=MockStreamingSTT())
    with TestClient(app) as c:
        yield c
    reset_settings_cache()


def test_redaction_comprehensive() -> None:
    text = (
        "My Aadhaar is 1234 5678 9012, PAN card is ABCDE1234F, CVV: 789, "
        "OTP is 482910, send 5000 to user@okhdfcbank or call 9876543210"
    )
    res = redact(text)
    assert "[AADHAAR]" in res.text
    assert "1234 5678 9012" not in res.text
    assert "[PAN]" in res.text
    assert "ABCDE1234F" not in res.text
    assert "[CVV]" in res.text
    assert "789" not in res.text
    assert "[CODE]" in res.text
    assert "482910" not in res.text
    assert "[UPI_ID]" in res.text
    assert "user@okhdfcbank" not in res.text
    # Phone number masked keeping only last 3 digits
    assert "XXXXXXX210" in res.text
    assert "9876543210" not in res.text


def test_rules_fire_before_redaction() -> None:
    raw_text = "This is CBI officer speaking, your account will be blocked. Share OTP 482910 immediately."
    hits = detect_hits(raw_text)
    assert len(hits) >= 3
    hit_texts = [h.text.lower() for h in hits]
    assert any("cbi" in t for t in hit_texts)
    assert any("blocked" in t or "block" in t for t in hit_texts)
    assert any("otp" in t for t in hit_texts)


def test_stt_status_with_key(test_client: TestClient) -> None:
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = httpx.Response(status_code=200, json={"tier": "starter"})
        mock_get.return_value = mock_resp
        res = test_client.get("/stt/status")
        assert res.status_code == 200
        data = res.json()
        assert data["provider"] == "elevenlabs"
        assert data["key_configured"] is True
        assert data["ok"] is True


def test_stt_status_missing_key(monkeypatch: pytest.MonkeyPatch) -> None:
    reset_settings_cache()
    settings = Settings(
        _env_file=None,
        database_url="sqlite://",
        stt_backend="elevenlabs",
        eleven_labs_api_key="",
        stt_allow_mock=False,
    )
    from app.main import app

    app.state.service = AnalysisService(settings=settings, stt=MockSpeechToText(), load_model=False)
    with TestClient(app) as c:
        res = c.get("/stt/status")
        assert res.status_code == 200
        data = res.json()
        assert data["key_configured"] is False
        assert data["ok"] is False
        assert "not set" in data["error"]
    reset_settings_cache()


def test_scribe_token_requires_consent(test_client: TestClient) -> None:
    res = test_client.post("/elevenlabs/scribe-token", data={"consent_confirmed": "false"})
    assert res.status_code in (400, 422)
    assert "consent_required" in res.text


def test_scribe_token_success(test_client: TestClient) -> None:
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_resp = httpx.Response(status_code=200, json={"token": "sutkn_mock_abc123"})
        mock_post.return_value = mock_resp
        res = test_client.post("/elevenlabs/scribe-token", data={"consent_confirmed": "true"})
        assert res.status_code == 200
        assert res.json()["token"] == "sutkn_mock_abc123"


def test_transcribe_requires_consent(test_client: TestClient) -> None:
    wav_data = wav_bytes(synthetic_speechlike(1.0))
    res = test_client.post(
        "/transcribe",
        files={"file": ("test.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"consent_confirmed": "false"},
    )
    assert res.status_code in (400, 422)
    assert "consent_required" in res.text


def test_transcribe_unsupported_format(test_client: TestClient) -> None:
    res = test_client.post(
        "/transcribe",
        files={"file": ("malicious.exe", io.BytesIO(b"MZ123"), "application/octet-stream")},
        data={"consent_confirmed": "true"},
    )
    assert res.status_code in (400, 422)
    assert "unsupported_format" in res.text


def test_transcribe_mock_elevenlabs_success(test_client: TestClient) -> None:
    wav_data = wav_bytes(synthetic_speechlike(2.0))
    eleven_resp = {
        "text": "This is CBI officer speaking. Aapka account block ho jayega. Please verify OTP 889911 immediately.",
        "language_code": "hin",
        "words": [
            {"text": "This", "start": 0.0, "end": 0.3},
            {"text": "is", "start": 0.3, "end": 0.5},
            {"text": "CBI", "start": 0.5, "end": 0.9},
            {"text": "officer", "start": 0.9, "end": 1.4},
            {"text": "speaking.", "start": 1.4, "end": 1.9},
        ],
    }
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = httpx.Response(status_code=200, json=eleven_resp)
        res = test_client.post(
            "/transcribe",
            files={"file": ("sample.wav", io.BytesIO(wav_data), "audio/wav")},
            data={"consent_confirmed": "true"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["provider"] == "elevenlabs"
        assert "[CODE]" in data["transcript"]
        assert "889911" not in data["transcript"]
        assert data["analysis"] is not None
        assert data["analysis"]["risk_score"] > 30
