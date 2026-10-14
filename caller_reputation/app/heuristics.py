"""Layer 1: offline number analysis using Google's libphonenumber."""
import re
from dataclasses import dataclass, field

import phonenumbers
from phonenumbers import NumberParseException, PhoneNumberType as T

from .config import HOME_REGION

# Regions often seen in reported scam-call campaigns targeting India.
# Tunable heuristic, NOT evidence that any given caller is a scammer.
HIGH_RISK_REGIONS = {"PK", "NG", "KH", "MM", "LA", "VN", "ID", "GH"}

MAX_BONUS = 0.5  # heuristics alone can never make a number look "certain"

_TYPE_NAMES = {v: k.lower() for k, v in vars(T).items() if isinstance(v, int) and k.isupper()}


@dataclass
class NumberAnalysis:
    canonical: str                 # E.164 where possible; this is what gets hashed
    valid: bool
    region: str | None = None
    number_type: str | None = None
    category: str | None = None    # "telemarketer", "invalid", or None
    bonus: float = 0.0
    signals: list[str] = field(default_factory=list)


def _digits(raw: str) -> str:
    return re.sub(r"\D", "", raw)


def _indian_local(raw: str) -> str | None:
    """Return the 10-digit Indian national number, or None if not Indian-style."""
    d = _digits(raw)
    if raw.strip().startswith("+") and not d.startswith("91"):
        return None
    if len(d) == 12 and d.startswith("91"):
        return d[2:]
    if len(d) == 11 and d.startswith("0"):
        return d[1:]
    if len(d) == 10:
        return d
    return None


def analyze_number(raw: str, via_international: bool = False) -> NumberAnalysis:
    """
    raw: number as received (any format).
    via_international: True if the telecom layer says the call arrived over an
        international route (used to detect +91 spoofing).
    """
    # TRAI telemarketer series: 140xxxxxxx = promotional, 160xxxxxxx = service/transactional.
    # Checked first because these can fail normal validity checks.
    local = _indian_local(raw)
    if local and local.startswith("140"):
        return NumberAnalysis("+91" + local, True, "IN", "telemarketer", "telemarketer",
                              0.05, ["trai_140_promotional_series"])
    if local and local.startswith("160"):
        return NumberAnalysis("+91" + local, True, "IN", "telemarketer", "telemarketer",
                              0.0, ["trai_160_service_series"])

    try:
        num = phonenumbers.parse(raw, HOME_REGION)
    except NumberParseException:
        return NumberAnalysis(_digits(raw) or raw.strip(), False, None, None, "invalid",
                              0.2, ["unparseable_number"])

    canonical = phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.E164)
    region = phonenumbers.region_code_for_number(num)
    ntype = phonenumbers.number_type(num)
    a = NumberAnalysis(canonical, phonenumbers.is_valid_number(num), region,
                       _TYPE_NAMES.get(ntype, "unknown"))

    if not a.valid:
        a.bonus += 0.2
        a.category = "invalid"
        a.signals.append("invalid_number")

    if region != HOME_REGION:
        a.bonus += 0.15
        a.signals.append(f"foreign_number:{region or 'unknown'}")
        if region in HIGH_RISK_REGIONS:
            a.bonus += 0.15
            a.signals.append("high_risk_origin_region")

    if ntype == T.VOIP:
        a.bonus += 0.2
        a.signals.append("voip_number")
    elif ntype == T.PREMIUM_RATE:
        a.bonus += 0.2
        a.signals.append("premium_rate_number")

    if via_international and region == HOME_REGION:
        a.bonus += 0.3
        a.signals.append("possible_spoofing_91_via_international_route")

    a.bonus = round(min(a.bonus, MAX_BONUS), 3)
    return a
