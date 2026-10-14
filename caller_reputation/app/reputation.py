"""Combines Layers 1-3 into the CallerReputationScore the fusion engine consumes."""
import hashlib
import hmac
import math
from datetime import datetime

from sqlalchemy.orm import Session

from . import thirdparty
from .config import SALT
from .db import NumberSource, ScamNumber, Whitelist, utcnow
from .heuristics import analyze_number


def hash_number(canonical: str) -> str:
    return hmac.new(SALT.encode(), canonical.encode(), hashlib.sha256).hexdigest()


def mask_number(canonical: str) -> str:
    """
    Mask canonical phone number for safe display/logging.
    e.g. +919820144820 -> +91 98•••••820
    Never returns or exposes the full raw number.
    """
    cleaned = canonical.strip()
    if not cleaned:
        return "•••••"

    if cleaned.startswith("+91") and len(cleaned) >= 12:
        return f"+91 {cleaned[3:5]}•••••{cleaned[-3:]}"
    elif cleaned.startswith("+") and len(cleaned) >= 8:
        # e.g. +14155552671 -> +1 41•••••671
        return f"{cleaned[:2]} {cleaned[2:4]}•••••{cleaned[-3:]}"
    elif len(cleaned) >= 7:
        return f"{cleaned[:2]}•••••{cleaned[-3:]}"
    elif len(cleaned) >= 4:
        return f"{cleaned[:1]}•••••{cleaned[-1:]}"
    else:
        return "•••••"


def get_risk_level(score: float) -> str:
    """
    Map reputation score to risk level tier:
    0.00 - 0.39 -> SAFE
    0.40 - 0.69 -> SUSPICIOUS
    0.70 - 1.00 -> HIGH_RISK
    """
    if score >= 0.70:
        return "HIGH_RISK"
    elif score >= 0.40:
        return "SUSPICIOUS"
    else:
        return "SAFE"


def db_score(count: int, last_reported: datetime, now: datetime | None = None) -> float:
    """
    volume : saturating curve, ~5 reports -> 0.63, ~15 -> 0.95
    recency: halves every 45 days, floored at 0.1 so old known scammers never fully vanish
    """
    if count <= 0:
        return 0.0
    now = now or utcnow()
    days = max((now - last_reported).total_seconds() / 86400, 0)
    volume = 1 - math.exp(-count / 5)
    recency = max(0.5 ** (days / 45), 0.1)
    return round(volume * recency, 3)


def check_reputation(session: Session, raw_number: str, via_international: bool = False) -> dict:
    a = analyze_number(raw_number, via_international)
    h = hash_number(a.canonical)
    masked = mask_number(a.canonical)

    wl = session.get(Whitelist, h)
    if wl:
        return {
            "number_hash": h,
            "score": 0.0,
            "category": "whitelisted",
            "report_count": 0,
            "signals": ["whitelisted_official_number"],
            "in_database": False,
            "last_reported": None,
            "sources": ["whitelist"],
            "risk_level": "SAFE",
            "normalized_number_masked": masked,
            "is_whitelisted": True,
            "whitelist_name": wl.label or "Official Entity",
        }

    signals = list(a.signals)
    category = a.category
    count, dbs = 0, 0.0
    in_database = False
    last_reported_iso = None
    sources: list[str] = []

    row = session.get(ScamNumber, h)
    if row:
        in_database = True
        count = row.report_count
        dbs = db_score(count, row.last_reported)
        category = row.category
        if row.last_reported:
            last_reported_iso = row.last_reported.isoformat()
            days = int((utcnow() - row.last_reported).total_seconds() // 86400)
            signals += [f"reported_{count}_times", f"last_reported_{days}d_ago"]

        # Look up distinct sources for this number hash
        src_rows = session.query(NumberSource.source).filter_by(number_hash=h).distinct().all()
        if src_rows:
            sources = [s[0] for s in src_rows if s[0]]
        elif row.source:
            sources = [row.source]

    api = thirdparty.lookup(a.canonical)
    if api is not None:
        signals.append(f"third_party_fraud_score:{api:.2f}")

    # reputation = max(db, api) + heuristic_bonus, capped at 1.0
    score = round(min(1.0, max(dbs, api or 0.0) + a.bonus), 3)
    risk_level = get_risk_level(score)

    return {
        "number_hash": h,
        "score": score,
        "category": category or "unknown",
        "report_count": count,
        "signals": signals,
        "in_database": in_database,
        "last_reported": last_reported_iso,
        "sources": sources,
        "risk_level": risk_level,
        "normalized_number_masked": masked,
        "is_whitelisted": False,
        "whitelist_name": None,
    }
