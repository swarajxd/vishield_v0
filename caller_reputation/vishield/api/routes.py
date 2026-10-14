"""REST and WebSocket endpoints."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status,
)

from vishield import __version__
from vishield.api.deps import get_ingestion_service, get_service
from vishield.api.errors import CallNotFoundError
from vishield.audio.validation import AudioValidationError
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

