"""Redaction of potentially sensitive values before logging or persistence.

The redactor is deliberately over-eager: a false redaction costs nothing, whereas a
leaked OTP or account number in the database would violate the project's privacy policy.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Order matters: longer / more specific patterns run first so that, for example,
# an Aadhaar number is replaced before a generic account number or OTP sees it.
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "url",
        re.compile(
            r"\b(?:https?://|www\.)\S+|\b[\w-]+\.(?:com|in|net|org|co|io|xyz|info|link)\b(?:/\S*)?",
            re.I,
        ),
    ),
    ("email", re.compile(r"\b[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}\b")),
    ("upi_id", re.compile(r"\b[a-zA-Z0-9.\-_]{2,64}@(okhdfcbank|okaxis|oksbi|okicici|paytm|upi|ybl|apl|axl|ibl|barodampay|federal|idfcbank|kotak|allbank|citi|pnb|[a-zA-Z]{2,30})\b", re.I)),
    ("pan", re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b", re.I)),
    ("aadhaar", re.compile(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b")),
    ("cvv", re.compile(r"(?i:\b(?:cvv|cvc|security\s+code)\s*(?:is|:)?\s*)(\d{3,4})\b")),
    ("card_number", re.compile(r"\b(?:\d[ -]?){13,19}\b")),
    ("account_number", re.compile(r"\b\d{9,18}\b")),
    ("phone", re.compile(r"(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,5}\b")),
    ("otp", re.compile(r"\b\d{4,8}\b")),
]

_REPLACEMENTS = {
    "url": "[URL]",
    "email": "[EMAIL]",
    "upi_id": "[UPI_ID]",
    "pan": "[PAN]",
    "aadhaar": "[AADHAAR]",
    "card_number": "[CARD]",
    "account_number": "[ACCOUNT]",
    "otp": "[CODE]",
}


@dataclass(frozen=True)
class RedactionResult:
    text: str
    counts: dict[str, int] = field(default_factory=dict)

    @property
    def total(self) -> int:
        return sum(self.counts.values())


def _mask_phone_match(match: re.Match[str]) -> str:
    s = match.group(0)
    digits = [c for c in s if c.isdigit()]
    if len(digits) >= 10:
        last3 = "".join(digits[-3:])
        return f"XXXXXXX{last3}"
    return "[PHONE]"


def redact(text: str) -> RedactionResult:
    """Replace URLs, emails, PAN, Aadhaar, CVV, UPI IDs, cards, accounts, phone numbers and OTP."""
    counts: dict[str, int] = {}
    redacted = text

    # 1. Handle CVV specific regex group replacement
    cvv_pat = dict(_PATTERNS)["cvv"]
    def _mask_cvv(m: re.Match[str]) -> str:
        full = m.group(0)
        digits = m.group(1)
        return full.replace(digits, "[CVV]")
    redacted, n_cvv = cvv_pat.subn(_mask_cvv, redacted)
    if n_cvv:
        counts["cvv"] = n_cvv

    # 2. Redact high-priority identifiers before generic digit/phone matchers
    high_priority = ("url", "email", "upi_id", "pan", "aadhaar", "card_number")
    for name in high_priority:
        pattern = dict(_PATTERNS)[name]
        redacted, n = pattern.subn(_REPLACEMENTS[name], redacted)
        if n:
            counts[name] = n

    # 3. Handle phone masking keeping last 3 digits
    phone_pat = dict(_PATTERNS)["phone"]
    redacted, n_phone = phone_pat.subn(_mask_phone_match, redacted)
    if n_phone:
        counts["phone"] = n_phone

    # 4. Handle account numbers
    acc_pat = dict(_PATTERNS)["account_number"]
    redacted, n_acc = acc_pat.subn(_REPLACEMENTS["account_number"], redacted)
    if n_acc:
        counts["account_number"] = n_acc

    # 4. Handle remaining (OTP)
    otp_pat = dict(_PATTERNS)["otp"]
    redacted, n_otp = otp_pat.subn(_REPLACEMENTS["otp"], redacted)
    if n_otp:
        counts["otp"] = n_otp

    return RedactionResult(text=redacted, counts=counts)


def contains_sensitive(text: str) -> bool:
    """True if any redaction pattern matches (used by the dataset PII scanner)."""
    return any(p.search(text) for _, p in _PATTERNS)
