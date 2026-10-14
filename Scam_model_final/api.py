"""FastAPI backend server for Scam Model.

Features:
- CORS enabled for React / Web frontends (localhost:3000, localhost:5173, etc.)
- /score: returns ConversationScamOutput conforming to Teammate Integration Guide
- /build-fusion-payload: formats output into the exact payload expected by Risk Fusion Engine
- /health: status and model readiness probe
"""

from __future__ import annotations

from pathlib import Path
from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .data.schema import ConversationScamOutput, PredictRequest
from .predictor import ScamPredictor
from .adapter import ConversationAdapter

app = FastAPI(
    title="ViShield Conversation Scam Evaluator API",
    description="Standalone neural NLP microservice for voice phishing & conversational scam detection",
    version="1.0.0",
)

# Enable CORS for React and frontend applications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global predictor and adapter
predictor: ScamPredictor | None = None
adapter: ConversationAdapter | None = None
STATIC_HTML = Path(__file__).resolve().parent / "index.html"


@app.on_event("startup")
def load_model():
    global predictor, adapter
    predictor = ScamPredictor()
    adapter = ConversationAdapter(predictor)


@app.get("/")
def index():
    """Serves the interactive HTML & JS testing page."""
    if STATIC_HTML.exists():
        return FileResponse(STATIC_HTML)
    return {"message": "ViShield Scam Model API is running. Visit /docs for Swagger UI."}


class FusionPayloadRequest(BaseModel):
    call_id: str = "call-001"
    text: str
    voice_spoof_score: float = Field(default=0.0, ge=0.0, le=1.0)
    caller_reputation_score: float = Field(default=0.0, ge=0.0, le=1.0)
    metadata: dict[str, Any] = Field(default_factory=lambda: {"language": "Hinglish/English"})


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": predictor is not None and predictor.model is not None,
        "device": str(predictor.device) if predictor else "unknown",
    }


@app.post("/score", response_model=ConversationScamOutput)
def score(payload: PredictRequest):
    """Primary endpoint for scoring a conversation.

    Conforms 1:1 with Section 2 of Teammate Integration Guide:
    - conversation_scam_score in [0.0, 1.0]
    - criteria with 6 phishing indicators
    - evidence flags: bank_impersonation, otp_or_credential_request, urgency_or_fear, etc.
    - risk_level: SAFE / SUSPICIOUS / HIGH_RISK
    """
    if predictor is None:
        raise HTTPException(status_code=503, detail="Model is still initializing")
    if not payload.text or not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text field cannot be empty")

    return predictor.predict_fusion(text=payload.text, call_id=payload.call_id)


@app.post("/evaluate", response_model=ConversationScamOutput)
def evaluate(payload: PredictRequest):
    """Alias for /score."""
    return score(payload)


@app.post("/build-fusion-payload")
def build_fusion_payload(payload: FusionPayloadRequest):
    """Constructs the exact JSON request payload needed by POST /api/v1/risk/evaluate."""
    if adapter is None:
        raise HTTPException(status_code=503, detail="Adapter not ready")

    return adapter.build_fusion_payload(
        text=payload.text,
        call_id=payload.call_id,
        voice_spoof_score=payload.voice_spoof_score,
        caller_reputation_score=payload.caller_reputation_score,
        metadata=payload.metadata,
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("Scam_model_final.api:app", host="0.0.0.0", port=port, reload=True)
