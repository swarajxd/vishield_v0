import logging
import time
from collections import defaultdict, deque
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Literal

import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from .config import CORS_ORIGINS, REPORT_LIMIT, REPORT_WINDOW_SEC
from .live import attach_live_routes, init_live_services
from .db import (
    Incident,
    NumberSource,
    ReportLog,
    ScamNumber,
    ScrapeLog,
    SessionLocal,
    Whitelist,
    init_db,
    utcnow,
)
from .heuristics import analyze_number
from .reputation import check_reputation, hash_number, mask_number

logger = logging.getLogger("caller_reputation")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    init_live_services(_app)
    yield


app = FastAPI(title="Caller Reputation Service", lifespan=lifespan)

# Setup CORS middleware allowing dashboard origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()
attach_live_routes(app)
init_live_services(app)

# Mount Risk Fusion Engine API routes for a unified monolithic backend on port 8000
import importlib.util
_root_routes = Path(__file__).resolve().parent.parent.parent / "app" / "api" / "routes.py"
if _root_routes.exists():
    try:
        _spec = importlib.util.spec_from_file_location("risk_fusion_api_routes", _root_routes)
        if _spec and _spec.loader:
            _mod = importlib.util.module_from_spec(_spec)
            _spec.loader.exec_module(_mod)
            app.include_router(_mod.router)
    except Exception as _e:
        logger.warning(f"Could not mount Risk Fusion Engine routes: {_e}")

GOV_REPORT_LINKS = {
    "chakshu": "https://sancharsaathi.gov.in/sfc/",
    "cybercrime": "https://cybercrime.gov.in",
    "helpline": "1930",
}
Category = Literal[
    "bank_impersonation",
    "kyc",
    "lottery",
    "digital_arrest",
    "investment",
    "courier",
    "tech_support",
    "other",
]


def get_session():
    with SessionLocal() as s:
        yield s


# --- in-memory sliding-window limiter (swap for Redis in production) ---
_hits: dict[str, deque] = defaultdict(deque)


def _rate_limited(key: str) -> bool:
    now, q = time.time(), _hits[key]
    while q and now - q[0] > REPORT_WINDOW_SEC:
        q.popleft()
    if len(q) >= REPORT_LIMIT:
        return True
    q.append(now)
    return False


@app.get("/reputation/{number:path}")
def get_reputation(
    number: str,
    via_international: bool = False,
    session: Session = Depends(get_session),
):
    """CallerReputationScore for the fusion engine. Example: /reputation/+919876543210"""
    # Note: number is normalized and hashed internally; never logged in raw form
    return check_reputation(session, number, via_international)


@app.get("/stats")
def get_stats(session: Session = Depends(get_session)):
    """Aggregate statistics for the dashboard UI."""
    total_scam_numbers = session.query(func.count(ScamNumber.number_hash)).scalar() or 0
    total_reports = session.query(func.count(ReportLog.id)).scalar() or 0
    whitelist_count = session.query(func.count(Whitelist.number_hash)).scalar() or 0

    # Counts per category
    category_counts = {}
    cat_rows = (
        session.query(ScamNumber.category, func.count(ScamNumber.number_hash))
        .group_by(ScamNumber.category)
        .all()
    )
    for cat, cnt in cat_rows:
        if cat:
            category_counts[cat] = cnt

    # Counts per source
    source_counts = {}
    src_rows = (
        session.query(NumberSource.source, func.count(NumberSource.id))
        .group_by(NumberSource.source)
        .all()
    )
    if src_rows:
        for src, cnt in src_rows:
            if src:
                source_counts[src] = cnt
    else:
        # Fallback to scam_numbers table sources
        alt_src_rows = (
            session.query(ScamNumber.source, func.count(ScamNumber.number_hash))
            .group_by(ScamNumber.source)
            .all()
        )
        for src, cnt in alt_src_rows:
            if src:
                source_counts[src] = cnt

    # Last scrape timestamp from scrape_log
    last_scrape_dt = session.query(func.max(ScrapeLog.scraped_at)).scalar()
    last_scrape_time = last_scrape_dt.isoformat() if last_scrape_dt else None

    return {
        "total_scam_numbers": total_scam_numbers,
        "total_reports": total_reports,
        "whitelist_count": whitelist_count,
        "categories": category_counts,
        "sources": source_counts,
        "last_scrape_time": last_scrape_time,
    }


class ReportIn(BaseModel):
    number: str
    category: Category = "other"
    reporter_id: str  # app user / device id (hashed before storage)


@app.post("/report", status_code=201)
def report(body: ReportIn, session: Session = Depends(get_session)):
    rkey = hash_number("reporter:" + body.reporter_id)
    if _rate_limited(rkey):
        raise HTTPException(429, "Too many reports. Try again later.")

    a = analyze_number(body.number)
    if a.category == "invalid" and not a.valid and not a.canonical.strip("+").isdigit():
        raise HTTPException(422, "Could not parse phone number.")
    h = hash_number(a.canonical)

    if session.get(Whitelist, h):
        raise HTTPException(
            409, "This is a verified official number; report it via the gov links instead."
        )
    if session.query(ReportLog).filter_by(number_hash=h, reporter_hash=rkey).first():
        raise HTTPException(409, "You have already reported this number.")

    session.add(ReportLog(number_hash=h, reporter_hash=rkey))
    row = session.get(ScamNumber, h)
    if row:
        row.report_count += 1
        row.last_reported = utcnow()
        if row.source == "community" and body.category != "other":
            row.category = body.category
    else:
        session.add(
            ScamNumber(
                number_hash=h,
                report_count=1,
                category=body.category,
                source="community",
                first_reported=utcnow(),
                last_reported=utcnow(),
            )
        )

    # Record or update community source trace
    src_entry = (
        session.query(NumberSource)
        .filter_by(number_hash=h, source="community")
        .first()
    )
    if not src_entry:
        session.add(
            NumberSource(
                number_hash=h,
                source="community",
                first_seen=utcnow(),
                last_seen=utcnow(),
            )
        )
    else:
        src_entry.last_seen = utcnow()

    session.commit()
    return {"status": "recorded", "also_report_to": GOV_REPORT_LINKS}


# ── Incident History Endpoints ────────────────────────────────────────────

@app.get("/incidents")
def get_incidents(session: Session = Depends(get_session)):
    """Return all pipeline evaluation incidents, newest first."""
    rows = (
        session.query(Incident)
        .order_by(Incident.created_at.desc())
        .limit(200)
        .all()
    )
    import json as _json
    return [
        {
            "callId": r.call_id,
            "timestamp": r.timestamp,
            "callerNumber": r.caller_number_masked,
            "fullCaller": r.caller_number_raw,
            "duration": f"{int(r.duration_seconds // 60):02d}:{int(r.duration_seconds % 60):02d}",
            "durationSeconds": r.duration_seconds,
            "language": r.detected_language,
            "conversationScore": r.conversation_score,
            "aasistScore": r.aasist_score,
            "reputationScore": r.reputation_score,
            "finalRisk": r.final_risk,
            "riskLevel": r.classification,
            "detectedIndicators": _json.loads(r.detected_indicators) if r.detected_indicators else [],
            "guardianStatus": r.guardian_status,
            "transcriptPreview": (r.transcript[:120] + "...") if len(r.transcript) > 120 else r.transcript,
            "audioFile": r.audio_file,
        }
        for r in rows
    ]


@app.post("/pipeline/evaluate")
async def evaluate_pipeline_endpoint(
    file: UploadFile = File(...),
    phone_number: str = Form("+91 98402 11982"),
    transcript: str | None = Form(None),
):
    """
    End-to-end pipeline: Audio -> AASIST + Caller Reputation + Scam Model -> Fused Result.
    Persists every evaluation as an Incident row in the database.
    """
    import tempfile
    import shutil
    import json as _json
    from evaluate_pipeline import run_pipeline

    suffix = Path(file.filename or "call.wav").suffix or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        result = run_pipeline(tmp_path, caller_number=phone_number, transcript_override=transcript)

        # ── Persist the result as an Incident ─────────────────────────────
        tri = result.get("tri_signal_scores", {})
        guardian = result.get("guardian_notification", {})
        indicators = result.get("detected_phishing_indicators", [])

        incident = Incident(
            call_id=result["call_id"],
            timestamp=result["timestamp"],
            caller_number_raw=result.get("caller_number_raw", phone_number),
            caller_number_masked=result.get("caller_number_masked", ""),
            duration_seconds=result.get("duration_seconds", 0.0),
            detected_language=result.get("detected_language", "en"),
            conversation_score=tri.get("conversation_scam_score", 0.0),
            aasist_score=tri.get("aasist_spoof_score", 0.0),
            reputation_score=tri.get("caller_reputation_score", 0.0),
            final_risk=result.get("final_risk_score", 0.0),
            classification=result.get("classification", "SAFE"),
            detected_indicators=_json.dumps(indicators),
            guardian_status=guardian.get("status", "NOT_TRIGGERED"),
            transcript=result.get("transcript", ""),
            audio_file=result.get("audio_file", ""),
            full_result_json=_json.dumps(result, default=str),
        )

        with SessionLocal() as db:
            db.add(incident)
            db.commit()

        return result
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass
