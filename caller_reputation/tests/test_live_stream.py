"""Live-stream ingestion mounted on the caller-reputation API (no root vishield/ folder)."""

from __future__ import annotations

import io
import time
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tests.audio_fixtures import synthetic_speechlike, wav_bytes
from vishield.config import Settings, reset_settings_cache
from vishield.services.analyzer import AnalysisService
from vishield.services.ingestion import IngestionService
from vishield.stt.mock import MockSpeechToText, MockStreamingSTT


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("VISHIELD_STT_BACKEND", "mock")
    reset_settings_cache()
    settings = Settings(
        _env_file=None,
        database_url="sqlite://",
        stt_backend="mock",
        ingest_chunk_seconds=5.0,
    )
    from app.main import app

    app.state.service = AnalysisService(settings=settings, stt=MockSpeechToText(), load_model=False)
    app.state.ingestion_service = IngestionService(settings=settings, stt=MockStreamingSTT())
    with TestClient(app) as c:
        yield c
    reset_settings_cache()


def test_vishield_package_is_bundled_in_backend() -> None:
    import vishield

    package_path = Path(vishield.__file__).resolve()
    backend_root = Path(__file__).resolve().parents[1]
    assert backend_root in package_path.parents
    assert package_path.parts[-2:] == ("vishield", "__init__.py")


def test_health_exposes_streaming_stt(client: TestClient) -> None:
    payload = client.get("/health").json()
    assert payload["status"] == "ok"
    assert payload["streaming_stt_available"] is True
    assert payload["stt_backend"] == "mock"


def test_upload_requires_consent(client: TestClient) -> None:
    wav_data = wav_bytes(synthetic_speechlike(3.0))
    res = client.post(
        "/calls/upload",
        files={"file": ("test.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"consent_confirmed": "false"},
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "audio_consent_required"


def test_upload_transcript_and_analysis(client: TestClient) -> None:
    wav_data = wav_bytes(synthetic_speechlike(6.0))
    upload = client.post(
        "/calls/upload",
        files={"file": ("call.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"consent_confirmed": "true", "realtime": "false"},
    )
    assert upload.status_code == 200
    call_id = upload.json()["call_id"]

    deadline = time.time() + 8
    chunks = []
    while time.time() < deadline:
        got = client.get(f"/calls/{call_id}/transcript")
        assert got.status_code == 200
        chunks = got.json()["chunks"]
        if chunks:
            break
        time.sleep(0.1)
    assert chunks

    analysis = client.get(f"/calls/{call_id}/analysis")
    assert analysis.status_code == 200
    body = analysis.json()
    assert body["call_id"] == call_id
    assert body["analysis"] is not None
    assert "risk_score" in body["analysis"]


def test_transcript_unknown_call(client: TestClient) -> None:
    res = client.get("/calls/does-not-exist/transcript")
    assert res.status_code == 404


def test_analyze_transcript_detects_otp_scam(client: TestClient) -> None:
    res = client.post(
        "/analyze/transcript",
        json={
            "transcript": (
                "Namaste, State Bank fraud branch se bol raha hoon. "
                "Account block ho jayega. Turant OTP verify kijiye."
            ),
            "consent_confirmed": True,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["risk_score"] >= 35
    categories = {ind["category"] for ind in data["indicators"]}
    assert categories & {"urgency", "authority", "credential_request", "fear_threat"}


def test_websocket_streams_chunks(client: TestClient) -> None:
    wav_data = wav_bytes(synthetic_speechlike(10.0))
    upload = client.post(
        "/calls/upload",
        files={"file": ("call_stream.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"consent_confirmed": "true", "realtime": "false"},
    )
    call_id = upload.json()["call_id"]
    received = []
    with client.websocket_connect(f"/calls/{call_id}/transcripts") as ws:
        while True:
            try:
                msg = ws.receive_json()
            except Exception:
                break
            if "error" in msg:
                break
            if "chunk_id" in msg:
                received.append(msg)
    assert received
    assert "text" in received[0]
    assert "language" in received[0]


def test_websocket_replays_after_processing(client: TestClient) -> None:
    wav_data = wav_bytes(synthetic_speechlike(6.0))
    upload = client.post(
        "/calls/upload",
        files={"file": ("late.wav", io.BytesIO(wav_data), "audio/wav")},
        data={"consent_confirmed": "true", "realtime": "false"},
    )
    call_id = upload.json()["call_id"]

    deadline = time.time() + 8
    while time.time() < deadline:
        body = client.get(f"/calls/{call_id}/analysis").json()
        if body.get("status") in {"completed", "failed"} and body.get("chunks_processed"):
            break
        time.sleep(0.05)

    received = []
    with client.websocket_connect(f"/calls/{call_id}/transcripts") as ws:
        while True:
            try:
                msg = ws.receive_json()
            except Exception:
                break
            if "chunk_id" in msg:
                received.append(msg)
    assert received
    assert any(msg.get("text") for msg in received)
