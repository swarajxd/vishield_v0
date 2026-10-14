"""Layer 3 (optional): IPQualityScore phone lookup, cached so the free quota survives."""
import time

import httpx

from .config import IPQS_API_KEY

_CACHE: dict[str, tuple[float, float | None]] = {}
TTL = 24 * 3600


def lookup(e164: str) -> float | None:
    """Return a 0-1 fraud score, or None if unavailable. Never raises."""
    if not IPQS_API_KEY:
        return None
    hit = _CACHE.get(e164)
    if hit and time.time() - hit[0] < TTL:
        return hit[1]
    score = None
    try:
        r = httpx.get(f"https://ipqualityscore.com/api/json/phone/{IPQS_API_KEY}/{e164}", timeout=3.0)
        data = r.json()
        if data.get("success"):
            score = min(max(data.get("fraud_score", 0) / 100, 0.0), 1.0)
    except Exception:
        return None  # don't cache failures
    _CACHE[e164] = (time.time(), score)
    return score
