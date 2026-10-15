"""Voice Phishing Evaluator - Risk Fusion Engine API Entrypoint.

Starts FastAPI application with validated settings and OpenAPI documentation.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context verifying startup configuration integrity."""
    settings = get_settings()
    # Eagerly trigger weight and threshold validators
    assert settings.weight_conversation >= 0.0
    yield


settings = get_settings()

app = FastAPI(
    title="Voice Phishing Evaluator - Risk Fusion Engine",
    description=(
        "Production-ready deterministic risk fusion engine combining Conversation Scam Analysis "
        "(Azure Speech + LLM Foundry), Voice Anti-Spoofing (AASIST), and Caller Reputation Signals. "
        "Built for the Voice Phishing Evaluator project."
    ),
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Enable CORS for local web dashboards and frontend integrations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

# Mount caller reputation and live stream routes so root app.main:app serves everything
try:
    from caller_reputation.app.main import app as caller_rep_app
    for _r in caller_rep_app.routes:
        if getattr(_r, "path", None) and _r.path not in [existing.path for existing in app.routes]:
            app.routes.append(_r)
    if hasattr(caller_rep_app.state, "service"):
        app.state.service = caller_rep_app.state.service
    if hasattr(caller_rep_app.state, "ingestion_service"):
        app.state.ingestion_service = caller_rep_app.state.ingestion_service
except Exception as _err:
    pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
