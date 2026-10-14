"""Redaction of potentially sensitive values before logging or persistence.

The redactor is deliberately over-eager: a false redaction costs nothing, whereas a
leaked OTP or account number in the database would violate the project's privacy policy.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Order matters: longer / more specific patterns run first so that, for example,
# a URL containing digits is replaced before the digit patterns see it.
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("email", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")),
    (
        "url",
        re.compile(
            r"\b(?:https?://|www\.)\S+|\b[\w-]+\.(?:com|in|net|org|co|io|xyz|info|link)\b(?:/\S*)?",
            re.I,
        ),
    ),
    ("card_number", re.compile(r"\b(?:\d[ -]?){13,19}\b")),
    ("account_number", re.compile(r"\b\d{9,18}\b")),
    ("phone", re.compile(r"(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,5}\b")),
    ("otp", re.compile(r"\b\d{4,8}\b")),
]

_REPLACEMENTS = {
    "url": "[URL]",
    "email": "[EMAIL]",
    "card_number": "[CARD]",
    "account_number": "[ACCOUNT]",
    "phone": "[PHONE]",
    "otp": "[CODE]",
}


@dataclass(frozen=True)
class RedactionResult:
    text: str
    counts: dict[str, int] = field(default_factory=dict)

    @property
    def total(self) -> int:
        return sum(self.counts.values())


def redact(text: str) -> RedactionResult:
    """Replace URLs, emails, card/account/phone numbers and OTP-like values."""
    counts: dict[str, int] = {}
    redacted = text
    for name, pattern in _PATTERNS:
        redacted, n = pattern.subn(_REPLACEMENTS[name], redacted)
        if n:
            counts[name] = n
    return RedactionResult(text=redacted, counts=counts)


def contains_sensitive(text: str) -> bool:
    """True if any redaction pattern matches (used by the dataset PII scanner)."""
    return any(p.search(text) for _, p in _PATTERNS)
