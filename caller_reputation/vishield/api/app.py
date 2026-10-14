"""FastAPI application factory."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from starlette.middleware.base import BaseHTTPMiddleware

from vishield import __version__
from vishield.api.errors import register_exception_handlers
from vishield.api.routes import router
from vishield.config import Settings, get_settings
from vishield.domain.safety import ETHICS_BANNER
from vishield.infra.db import Database
from vishield.infra.logging import configure_logging
from vishield.infra.metrics import REGISTRY, http_metrics_middleware
from vishield.infra.repository import AnalysisRepository
from vishield.services.analyzer import AnalysisService
from vishield.services.ingestion import IngestionService

DESCRIPTION = f"""
**{ETHICS_BANNER}**

Endpoints analyse transcripts or short recordings for social-engineering indicators and
return an explainable risk score with defensive recommendations.
"""


def create_app(
    settings: Settings | None = None,
    service: AnalysisService | None = None,
    ingestion_service: IngestionService | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if service is not None:
            app.state.service = service
        else:
            repository = AnalysisRepository(Database(settings.database_url))
            app.state.service = AnalysisService(settings, repository=repository)

        if ingestion_service is not None:
            app.state.ingestion_service = ingestion_service
        else:
            app.state.ingestion_service = IngestionService(settings)
        yield


    app = FastAPI(
        title="ViShield API",
        version=__version__,
        description=DESCRIPTION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    if service is not None:
        app.state.service = service
    if ingestion_service is not None:
        app.state.ingestion_service = ingestion_service
    app.include_router(router)

    app.add_middleware(BaseHTTPMiddleware, dispatch=http_metrics_middleware)

    @app.get("/metrics", include_in_schema=False)
    def metrics() -> Response:
        return Response(generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)

    register_exception_handlers(app)
    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run("vishield.api.app:app", host="127.0.0.1", port=8000, reload=False)


if __name__ == "__main__":
    main()
