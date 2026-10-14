"""Entity masking and text normalization for ViShield model."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass


@dataclass
class MaskedResult:
    original_text: str
    normalized_text: str
    masked_text: str
    replacements: list[dict[str, str | int]]


# Entity regex patterns tailored for Indian financial communications
PHONE_REGEX = re.compile(
    r"(?:\+91[\-\s]?)?[6-9]\d{9}\b|\b\d{5}[\-\s]\d{5}\b",
    re.IGNORECASE,
)
URL_REGEX = re.compile(
    r"https?://[^\s/$.?#].[^\s]*|www\.[^\s]+\.[a-z]{2,}",
    re.IGNORECASE,
)
UPI_REGEX = re.compile(
    r"\b[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}\b",
    re.IGNORECASE,
)
OTP_REGEX = re.compile(
    r"\b(?:otp|code|pin)(?:\s*(?:is|hai|number|code))?\s*[:\-]?\s*([0-9]{4,8})\b",
    re.IGNORECASE,
)
AMOUNT_REGEX = re.compile(
    r"(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d{2})?|\b[\d,]+(?:\.\d{2})?\s*(?:rupees|rupaye|rs)\b",
    re.IGNORECASE,
)
ACCOUNT_REGEX = re.compile(
    r"\b(?:a/c|account\s*no\.?|khata\s*no\.?)\s*[:\-]?\s*([0-9]{9,18})\b",
    re.IGNORECASE,
)


def normalize_text(text: str) -> str:
    """Applies Unicode NFC normalization while preserving original scripts and matras."""
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def mask_entities(text: str) -> MaskedResult:
    """Normalizes and masks sensitive entities into placeholders."""
    norm = normalize_text(text)
    masked = norm
    replacements: list[dict[str, str | int]] = []

    # 1. URL masking
    for match in URL_REGEX.finditer(norm):
        val = match.group()
        masked = masked.replace(val, "<URL>")
        replacements.append({"type": "URL", "original": val})

    # 2. UPI ID masking
    for match in UPI_REGEX.finditer(masked):
        val = match.group()
        if not val.startswith("<"):
            masked = masked.replace(val, "<UPI>")
            replacements.append({"type": "UPI", "original": val})

    # 3. OTP tokens
    for match in OTP_REGEX.finditer(masked):
        val = match.group(1) if match.groups() else match.group()
        masked = masked.replace(val, "<OTP>")
        replacements.append({"type": "OTP", "original": val})

    # 4. Amounts
    for match in AMOUNT_REGEX.finditer(masked):
        val = match.group()
        masked = masked.replace(val, "<AMOUNT>")
        replacements.append({"type": "AMOUNT", "original": val})

    # 5. Account numbers
    for match in ACCOUNT_REGEX.finditer(masked):
        val = match.group(1) if match.groups() else match.group()
        masked = masked.replace(val, "<ACCOUNT>")
        replacements.append({"type": "ACCOUNT", "original": val})

    # 6. Phone numbers
    for match in PHONE_REGEX.finditer(masked):
        val = match.group()
        masked = masked.replace(val, "<PHONE>")
        replacements.append({"type": "PHONE", "original": val})

    return MaskedResult(
        original_text=text,
        normalized_text=norm,
        masked_text=masked,
        replacements=replacements,
    )
