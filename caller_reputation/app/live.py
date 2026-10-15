"""Mount streaming STT + scam-analysis routes onto the caller-reputation FastAPI app.

The live-ingest package lives at ``caller_reputation/vishield`` (import name ``vishield``)
so the top-level ``vishield/`` project folder is not required at runtime.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from fastapi import FastAPI

# Ensure workspace root remains at top of sys.path while appending backend root for vishield resolution
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_WORKSPACE_ROOT = _BACKEND_ROOT.parent
_backend_root_str = str(_BACKEND_ROOT)
_workspace_root_str = str(_WORKSPACE_ROOT)

if _workspace_root_str not in sys.path:
    sys.path.insert(0, _workspace_root_str)
if _backend_root_str not in sys.path:
    sys.path.append(_backend_root_str)

from vishield.api.errors import register_exception_handlers
from vishield.api.routes import router
from vishield.config import get_settings
from vishield.services.analyzer import AnalysisService
from vishield.services.ingestion import IngestionService

log = logging.getLogger("caller_reputation.live")


def attach_live_routes(app: FastAPI) -> None:
    """Register live-stream HTTP/WebSocket routes. Safe to call once at import time."""
    app.include_router(router)
    register_exception_handlers(app, include_generic=False)


def init_live_services(app: FastAPI) -> None:
    """Build analysis + ingestion services on app.state."""
    if getattr(app.state, "service", None) is not None and getattr(
        app.state, "ingestion_service", None
    ) is not None:
        return
    settings = get_settings()
    app.state.service = AnalysisService(settings, repository=None, load_model=True)
    app.state.ingestion_service = IngestionService(settings)
    log.info(
        "Live stream analysis ready (stt=%s streaming=%s)",
        app.state.service.stt.name,
        app.state.ingestion_service.stt.name,
    )
