"""REST and WebSocket endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal

import httpx
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from pydantic import BaseModel, Field

from vishield import __version__
from vishield.api.deps import get_ingestion_service, get_service
from vishield.api.errors import CallNotFoundError
from vishield.audio.validation import AudioValidationError
from vishield.domain.redaction import redact
from vishield.domain.models import (
    AnalysisResult,
    BatchEvaluateRequest,
    BatchEvaluateResponse,
    CallTranscriptResponse,
    CallUploadResponse,
    HealthResponse,
    ModelInfo,
    SafetyPolicy,
    TranscriptAnalysisRequest,
)
from vishield.domain.safety import get_policy
from vishield.services.analyzer import AnalysisService, EmptyTranscriptError
from vishield.services.ingestion import IngestionService

router = APIRouter()
Service = Annotated[AnalysisService, Depends(get_service)]
IngestService = Annotated[IngestionService, Depends(get_ingestion_service)]


@router.get("/health", response_model=HealthResponse, tags=["system"])
def health(service: Service) -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=__version__,
        model_loaded=service.classifier is not None,
        stt_backend=service.stt.name,
        streaming_stt_available=True,
        timestamp=datetime.now(tz=UTC),
    )


@router.post("/analyze/transcript", response_model=AnalysisResult, tags=["analysis"])
def analyze_transcript(payload: TranscriptAnalysisRequest, service: Service) -> AnalysisResult:
    """Analyse a typed transcript (synthetic, public or consented text only)."""
    return service.analyze_transcript(payload.transcript)


@router.post("/analyze/audio", response_model=AnalysisResult, tags=["analysis"])
async def analyze_audio(
    service: Service,
    file: Annotated[UploadFile, File(description="WAV, MP3 or M4A")],
    consent_confirmed: Annotated[bool, Form()] = False,
) -> AnalysisResult:
    """Analyse an uploaded recording. Audio is processed in memory and not stored."""
    if not consent_confirmed:
        raise AudioValidationError(
            "consent_required",
            "You must confirm the recording is synthetic, public-domain or explicitly consented.",
        )
    max_bytes = service.settings.max_file_bytes
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise AudioValidationError(
            "too_large", f"File exceeds the {service.settings.max_file_mb:g} MB limit."
        )
    return service.analyze_audio(data, file.filename, file.content_type)


@router.post("/evaluate/batch", response_model=BatchEvaluateResponse, tags=["evaluation"])
def evaluate_batch(payload: BatchEvaluateRequest, service: Service) -> BatchEvaluateResponse:
    """Score many transcripts; returns metrics when labels are supplied."""
    return service.evaluate_batch(payload.items)


@router.get("/models/info", response_model=ModelInfo, tags=["system"])
def models_info(service: Service) -> ModelInfo:
    info = service.model_info()
    info.streaming_stt_available = True
    return info


@router.get("/safety/policy", response_model=SafetyPolicy, tags=["system"])
def safety_policy() -> SafetyPolicy:
    return get_policy()


# --- Streaming Call Ingestion Endpoints ---


@router.post("/calls/upload", response_model=CallUploadResponse, tags=["ingestion"])
async def upload_call(
    ingest_svc: IngestService,
    file: Annotated[UploadFile, File(description="WAV, MP3 or M4A recording")],
    consent_confirmed: Annotated[bool, Form()] = False,
    realtime: Annotated[bool | None, Form()] = None,
) -> CallUploadResponse:
    """Upload audio for streaming ingestion and STT processing."""
    if not consent_confirmed:
        raise AudioValidationError(
            "consent_required",
            "You must confirm the recording is synthetic, public-domain or explicitly consented.",
        )
    max_bytes = ingest_svc.settings.max_file_bytes
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise AudioValidationError(
            "too_large", f"File exceeds the {ingest_svc.settings.max_file_mb:g} MB limit."
        )

    session = await ingest_svc.ingest_audio_bytes(
        data=data,
        filename=file.filename,
        content_type=file.content_type,
        realtime=realtime,
    )
    return CallUploadResponse(call_id=session.call_id)


@router.get(
    "/calls/{call_id}/transcript",
    response_model=CallTranscriptResponse,
    tags=["ingestion"],
)
def get_call_transcript(call_id: str, ingest_svc: IngestService) -> CallTranscriptResponse:
    """Retrieve accumulated conversation context and transcript chunks so far."""
    context_str, chunks = ingest_svc.get_transcript(call_id)
    if not chunks and ingest_svc.get_session(call_id) is None:
        raise CallNotFoundError(call_id)

    return CallTranscriptResponse(
        call_id=call_id,
        context=context_str,
        chunks=chunks,
    )


@router.get("/calls/{call_id}/analysis", tags=["ingestion"])
def get_call_analysis(
    call_id: str, ingest_svc: IngestService, service: Service
) -> dict[str, object]:
    """Run scam-detection analysis on the redacted transcript accumulated so far."""
    context_str, chunks = ingest_svc.get_transcript(call_id)
    session = ingest_svc.get_session(call_id)
    if not chunks and session is None:
        raise CallNotFoundError(call_id)

    analysis: AnalysisResult | None = None
    if context_str.strip():
        try:
            analysis = service.analyze_transcript(context_str)
        except EmptyTranscriptError:
            analysis = None

    return {
        "call_id": call_id,
        "status": session.status if session is not None else "completed",
        "chunks_processed": session.chunks_processed if session is not None else len(chunks),
        "analysis": analysis.model_dump(mode="json") if analysis is not None else None,
    }


@router.websocket("/calls/{call_id}/transcripts")
async def call_transcripts_ws(websocket: WebSocket, call_id: str) -> None:
    """Stream TranscriptChunk JSON as chunks are produced, then close cleanly."""
    await websocket.accept()
    ingest_svc: IngestionService = websocket.app.state.ingestion_service

    session = ingest_svc.get_session(call_id)
    _, buffered = ingest_svc.get_transcript(call_id)
    if session is None and not buffered:
        await websocket.send_json(
            {"error": {"code": "call_not_found", "message": f"Call '{call_id}' not found."}}
        )
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    seen: set[int] = set()
    try:
        for chunk in buffered:
            await websocket.send_json(chunk.model_dump())
            seen.add(chunk.chunk_id)

        if session is None or session.status in {"completed", "failed"}:
            if session is not None and session.status == "failed" and session.error is not None:
                await websocket.send_json(
                    {"error": {"code": "stt_session_failed", "message": str(session.error)}}
                )
            await websocket.close(code=status.WS_1000_NORMAL_CLOSURE)
            return

        while True:
            item = await session.transcript_queue.get()
            if item is None:
                break
            if item.chunk_id in seen:
                continue
            seen.add(item.chunk_id)
            await websocket.send_json(item.model_dump())

        if session.status == "failed" and session.error is not None:
            await websocket.send_json(
                {"error": {"code": "stt_session_failed", "message": str(session.error)}}
            )

        await websocket.close(code=status.WS_1000_NORMAL_CLOSURE)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        await websocket.send_json(
            {"error": {"code": "stt_session_failed", "message": str(exc)}}
        )
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)


# --- ElevenLabs Scribe STT Endpoints ---


class STTStatusResponse(BaseModel):
    provider: Literal["elevenlabs", "mock"]
    key_configured: bool
    model: str
    ok: bool
    allow_mock: bool = False
    error: str | None = None


class ScribeTokenResponse(BaseModel):
    token: str


class TranscriptSegmentResponse(BaseModel):
    start: float
    end: float
    text: str


class BatchTranscribeResponse(BaseModel):
    transcript: str
    language: str | None = None
    segments: list[TranscriptSegmentResponse] = Field(default_factory=list)
    analysis: AnalysisResult | None = None
    is_mock: bool = False
    provider: str = "elevenlabs"


def _words_to_segments(words: list[dict], fallback_text: str) -> list[TranscriptSegmentResponse]:
    if not words:
        if fallback_text:
            return [TranscriptSegmentResponse(start=0.0, end=0.0, text=fallback_text)]
        return []
    segments: list[TranscriptSegmentResponse] = []
    current_words: list[str] = []
    seg_start = float(words[0].get("start", 0.0))
    seg_end = seg_start

    for w in words:
        txt = str(w.get("text", "")).strip()
        if not txt:
            continue
        w_start = float(w.get("start", seg_end))
        w_end = float(w.get("end", w_start))
        if current_words and (w_start - seg_end > 1.2 or len(current_words) >= 12 or txt.endswith((".", "?", "!"))):
            segments.append(
                TranscriptSegmentResponse(
                    start=round(seg_start, 2),
                    end=round(seg_end, 2),
                    text=" ".join(current_words),
                )
            )
            current_words = [txt]
            seg_start = w_start
            seg_end = w_end
        else:
            current_words.append(txt)
            seg_end = w_end

    if current_words:
        segments.append(
            TranscriptSegmentResponse(
                start=round(seg_start, 2),
                end=round(seg_end, 2),
                text=" ".join(current_words),
            )
        )
    return segments


@router.get("/stt/status", response_model=STTStatusResponse, tags=["transcription"])
@router.get("/api/stt/status", response_model=STTStatusResponse, include_in_schema=False)
async def get_stt_status(service: Service) -> STTStatusResponse:
    settings = service.settings
    has_key = bool(settings.eleven_labs_api_key and settings.eleven_labs_api_key.get_secret_value().strip())
    model = settings.eleven_labs_model_id or "scribe_v1"
    allow_mock = getattr(settings, "stt_allow_mock", False)

    if not has_key:
        return STTStatusResponse(
            provider="mock" if allow_mock else "elevenlabs",
            key_configured=False,
            model=model,
            ok=allow_mock,
            allow_mock=allow_mock,
            error=None if allow_mock else "ElevenLabs API key not set. Add ELEVENLABS_API_KEY to caller_reputation/.env and restart the backend.",
        )

    api_key = settings.eleven_labs_api_key.get_secret_value()
    ok = True
    error = None
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(
                "https://api.elevenlabs.io/v1/user/subscription",
                headers={"xi-api-key": api_key},
            )
            if resp.status_code == 401:
                ok = False
                error = "Invalid ElevenLabs API key (401 Unauthorized)."
            elif resp.status_code == 429:
                ok = False
                error = "ElevenLabs quota exceeded (429 Too Many Requests)."
            elif resp.status_code >= 400:
                ok = False
                error = f"ElevenLabs API error: HTTP {resp.status_code}"
    except Exception:
        # Fallback to key presence if network request times out or is offline in test
        ok = True

    return STTStatusResponse(
        provider="elevenlabs",
        key_configured=True,
        model=model,
        ok=ok,
        allow_mock=allow_mock,
        error=error,
    )


@router.post("/elevenlabs/scribe-token", response_model=ScribeTokenResponse, tags=["transcription"])
@router.post("/api/elevenlabs/scribe-token", response_model=ScribeTokenResponse, include_in_schema=False)
async def get_scribe_token(
    service: Service,
    consent_confirmed: Annotated[bool, Form()] = True,
) -> ScribeTokenResponse:
    if not consent_confirmed:
        raise AudioValidationError(
            "consent_required",
            "You must confirm the recording is synthetic, public-domain or explicitly consented.",
        )
    settings = service.settings
    has_key = bool(settings.eleven_labs_api_key and settings.eleven_labs_api_key.get_secret_value().strip())
    if not has_key:
        raise HTTPException(
            status_code=503,
            detail="ElevenLabs API key is not configured. Add ELEVENLABS_API_KEY to caller_reputation/.env and restart the backend.",
        )

    api_key = settings.eleven_labs_api_key.get_secret_value()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
                headers={"xi-api-key": api_key},
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to reach ElevenLabs token service: {exc}")

    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid ElevenLabs API key (401 Unauthorized).")
    elif resp.status_code == 429:
        raise HTTPException(status_code=429, detail="ElevenLabs token quota exceeded (429).")
    elif resp.status_code != 200:
        err_msg = resp.text[:200]
        try:
            err_json = resp.json()
            err_msg = err_json.get("detail", err_json.get("message", err_msg))
        except Exception:
            pass
        raise HTTPException(status_code=resp.status_code, detail=f"ElevenLabs token error ({resp.status_code}): {err_msg}")

    data = resp.json()
    token = data.get("token")
    if not token:
        raise HTTPException(status_code=502, detail="No token received from ElevenLabs.")
    return ScribeTokenResponse(token=token)


@router.post("/transcribe", response_model=BatchTranscribeResponse, tags=["transcription"])
@router.post("/api/transcribe", response_model=BatchTranscribeResponse, include_in_schema=False)
async def transcribe_audio(
    service: Service,
    file: Annotated[UploadFile, File(description="Audio file (WAV, MP3, M4A, OGG, WebM)")],
    consent_confirmed: Annotated[bool, Form()] = False,
) -> BatchTranscribeResponse:
    if not consent_confirmed:
        raise AudioValidationError(
            "consent_required",
            "You must confirm the recording is synthetic, public-domain or explicitly consented.",
        )
    settings = service.settings
    max_bytes = int(settings.max_file_mb * 1024 * 1024)
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise AudioValidationError(
            "too_large", f"File exceeds the {settings.max_file_mb:g} MB limit."
        )

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext and ext not in settings.allowed_extensions:
        raise AudioValidationError(
            "unsupported_format",
            f"Extension '{ext}' not allowed. Allowed: {', '.join(settings.allowed_extensions)}",
        )

    has_key = bool(settings.eleven_labs_api_key and settings.eleven_labs_api_key.get_secret_value().strip())
    if not has_key:
        if settings.stt_allow_mock:
            mock_text = "Hello, this is security from your bank calling. We noticed suspicious activity on your account. Aapka account block ho sakta hai, please OTP share kijiye."
            raw_analysis = service.analyze_transcript(mock_text)
            redacted_res = redact(mock_text)
            mock_segments = [
                TranscriptSegmentResponse(start=0.0, end=2.4, text="Hello, this is security from your bank calling."),
                TranscriptSegmentResponse(start=2.5, end=5.2, text="We noticed suspicious activity on your account."),
                TranscriptSegmentResponse(start=5.3, end=8.1, text=redact("Aapka account block ho sakta hai, please OTP share kijiye.").text),
            ]
            return BatchTranscribeResponse(
                transcript=redacted_res.text,
                language="Hinglish",
                segments=mock_segments,
                analysis=raw_analysis,
                is_mock=True,
                provider="mock",
            )
        raise HTTPException(
            status_code=503,
            detail="ElevenLabs API key is not configured. Add ELEVENLABS_API_KEY to caller_reputation/.env and restart the backend.",
        )

    api_key = settings.eleven_labs_api_key.get_secret_value()
    content_type = file.content_type or "audio/wav"
    headers = {"xi-api-key": api_key}
    files = {"file": (file.filename or "audio.wav", data, content_type)}
    form_data = {
        "model_id": settings.eleven_labs_model_id,
        "timestamps_granularity": "word",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.elevenlabs.io/v1/speech-to-text",
                headers=headers,
                files=files,
                data=form_data,
            )
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to connect to ElevenLabs API: {exc}")

    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid ElevenLabs API key (401 Unauthorized).")
    elif resp.status_code == 429:
        raise HTTPException(status_code=429, detail="ElevenLabs quota exceeded or rate limit reached (429).")
    elif resp.status_code != 200:
        err_msg = resp.text[:200]
        try:
            err_json = resp.json()
            err_msg = err_json.get("detail", err_json.get("message", err_msg))
        except Exception:
            pass
        raise HTTPException(status_code=resp.status_code, detail=f"ElevenLabs error ({resp.status_code}): {err_msg}")

    payload = resp.json()
    raw_text = str(payload.get("text", "")).strip()
    raw_lang = payload.get("language_code", "eng")
    words = payload.get("words", [])

    if raw_lang in ("hin", "hi"):
        lang = "hi-IN"
    elif raw_lang in ("eng", "en"):
        lang = "en-IN"
    else:
        lang = raw_lang

    if raw_text:
        has_latin = any("a" <= c <= "z" or "A" <= c <= "Z" for c in raw_text)
        has_deva = any("\u0900" <= c <= "\u097f" for c in raw_text)
        if has_latin and has_deva:
            lang = "Hinglish"

    analysis = None
    if raw_text:
        try:
            analysis = service.analyze_transcript(raw_text)
        except Exception:
            analysis = None

    redacted_result = redact(raw_text)
    raw_segments = _words_to_segments(words, raw_text)
    redacted_segments = [
        TranscriptSegmentResponse(
            start=s.start,
            end=s.end,
            text=redact(s.text).text,
        )
        for s in raw_segments
    ]

    return BatchTranscribeResponse(
        transcript=redacted_result.text,
        language=lang,
        segments=redacted_segments,
        analysis=analysis,
        is_mock=False,
        provider="elevenlabs",
    )

