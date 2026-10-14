"""Centralised exception handling with safe, non-leaking messages."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from vishield.audio.validation import AudioValidationError
from vishield.infra.metrics import record_error
from vishield.services.analyzer import EmptyTranscriptError
from vishield.stt import STTUnavailableError

log = logging.getLogger(__name__)


class CallNotFoundError(KeyError):
    """Raised when an unknown call_id is requested."""

    def __init__(self, call_id: str) -> None:
        super().__init__(f"Call '{call_id}' not found.")
        self.call_id = call_id


def _problem(status: int, code: str, message: str) -> JSONResponse:
    record_error(code)
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


def register_exception_handlers(app: FastAPI, *, include_generic: bool = True) -> None:
    @app.exception_handler(CallNotFoundError)
    async def _call_not_found(_: Request, exc: CallNotFoundError) -> JSONResponse:
        return _problem(404, "call_not_found", f"Call '{exc.call_id}' was not found.")

    @app.exception_handler(AudioValidationError)
    async def _audio(_: Request, exc: AudioValidationError) -> JSONResponse:
        status = 413 if exc.code == "too_large" else 422
        return _problem(status, f"audio_{exc.code}", exc.message)

    @app.exception_handler(EmptyTranscriptError)
    async def _empty(_: Request, exc: EmptyTranscriptError) -> JSONResponse:
        return _problem(422, "empty_transcript", str(exc))

    @app.exception_handler(STTUnavailableError)
    async def _stt(_: Request, exc: STTUnavailableError) -> JSONResponse:
        msg = str(exc)
        if "stt_session_failed" in msg:
            return _problem(502, "stt_session_failed", msg)
        return _problem(503, "stt_unavailable", msg)

    if not include_generic:
        return

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = sorted({str(e.get("loc", ["?"])[-1]) for e in exc.errors()})
        return _problem(422, "validation_error", f"Invalid request fields: {', '.join(fields)}")

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error: %s", exc.__class__.__name__)
        return _problem(500, "internal_error", "An internal error occurred. It has been logged.")
