"""Dataset records, loading, validation helpers and deterministic splitting."""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Iterable
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, model_validator

from vishield.config import RANDOM_SEED
from vishield.domain.redaction import contains_sensitive

Label = Literal["phishing", "legitimate"]

CATEGORIES: tuple[str, ...] = (
    "bank_verification_scam",
    "kyc_update_scam",
    "otp_request_scam",
    "tech_support_scam",
    "delivery_scam",
    "authority_threat_scam",
    "urgent_payment_scam",
    "legit_customer_support",
    "legit_bank_notification",
    "legit_personal_conversation",
)
LEGIT_PREFIX = "legit_"


class DatasetRecord(BaseModel):
    """One transcript record; mirrors ``data/schema.json``."""

    model_config = {"extra": "forbid"}

    id: str = Field(pattern=r"^vs-\d{4,}$")
    text: str = Field(min_length=20, max_length=5000)
    label: Label
    category: str
    language: str = Field(pattern=r"^[a-z]{2}(-[A-Z]{2})?$")
    source: Literal["synthetic", "public_domain", "licensed", "consented"]
    license: str = Field(min_length=2)
    consent: str = Field(min_length=2)
    notes: str | None = None

    @model_validator(mode="after")
    def _category_matches_label(self) -> DatasetRecord:
        if self.category not in CATEGORIES:
            raise ValueError(f"unknown category {self.category!r}")
        expected: Label = "legitimate" if self.category.startswith(LEGIT_PREFIX) else "phishing"
        if self.label != expected:
            raise ValueError(f"category {self.category!r} implies label {expected!r}")
        if self.source == "consented" and self.consent == "not_applicable_synthetic":
            raise ValueError("consented samples need a consent record reference")
        return self


class ValidationIssue(BaseModel):
    record_id: str | None
    kind: str
    message: str


def load_records(path: Path) -> list[DatasetRecord]:
    """Load JSONL records, raising on the first invalid line."""
    records: list[DatasetRecord] = []
    with path.open(encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, start=1):
            if not line.strip():
                continue
            try:
                records.append(DatasetRecord.model_validate_json(line))
            except ValidationError as exc:
                raise ValueError(f"{path}:{lineno}: {exc}") from exc
    return records


def write_records(path: Path, records: Iterable[DatasetRecord]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(rec.model_dump_json(exclude_none=True) + "\n")


_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^\w\s]")


def normalise_text(text: str) -> str:
    return _WS.sub(" ", _PUNCT.sub("", text.lower())).strip()


def _token_set(text: str) -> set[str]:
    return set(normalise_text(text).split())


def find_duplicates(
    records: list[DatasetRecord], near_threshold: float = 0.85
) -> list[ValidationIssue]:
    """Exact duplicates (after normalisation) and near duplicates by token Jaccard."""
    issues: list[ValidationIssue] = []
    seen: dict[str, str] = {}
    ids = [r.id for r in records]
    if len(ids) != len(set(ids)):
        dup_ids = [i for i, c in Counter(ids).items() if c > 1]
        issues.append(ValidationIssue(record_id=None, kind="duplicate_id", message=str(dup_ids)))
    tokens = [(r.id, _token_set(r.text)) for r in records]
    for rec in records:
        key = normalise_text(rec.text)
        if key in seen:
            issues.append(
                ValidationIssue(
                    record_id=rec.id, kind="exact_duplicate", message=f"same text as {seen[key]}"
                )
            )
        else:
            seen[key] = rec.id
    for i, (id_a, tok_a) in enumerate(tokens):
        for id_b, tok_b in tokens[i + 1 :]:
            if not tok_a or not tok_b:
                continue
            jaccard = len(tok_a & tok_b) / len(tok_a | tok_b)
            if jaccard >= near_threshold:
                issues.append(
                    ValidationIssue(
                        record_id=id_a,
                        kind="near_duplicate",
                        message=f"jaccard {jaccard:.2f} with {id_b}",
                    )
                )
    return issues


_DIGIT_RUN = re.compile(r"\d{4,}")
_NAME_LIKE_ORG = re.compile(
    r"\b(hdfc|icici|sbi|axis|kotak|paypal|amazon|flipkart|fedex|dhl|bluedart|airtel|jio|vodafone)\b",
    re.I,
)


def scan_pii(records: list[DatasetRecord]) -> list[ValidationIssue]:
    """Flag records that look like they contain real identifiers or real organisations."""
    issues: list[ValidationIssue] = []
    for rec in records:
        if contains_sensitive(rec.text) or _DIGIT_RUN.search(rec.text):
            issues.append(
                ValidationIssue(
                    record_id=rec.id,
                    kind="pii_pattern",
                    message="contains phone/account/OTP/email/URL-like pattern",
                )
            )
        if m := _NAME_LIKE_ORG.search(rec.text):
            issues.append(
                ValidationIssue(
                    record_id=rec.id,
                    kind="real_organisation",
                    message=f"mentions real organisation {m.group(0)!r}; use a placeholder",
                )
            )
    return issues


def class_distribution(records: list[DatasetRecord]) -> dict[str, dict[str, int]]:
    return {
        "label": dict(sorted(Counter(r.label for r in records).items())),
        "category": dict(sorted(Counter(r.category for r in records).items())),
        "source": dict(sorted(Counter(r.source for r in records).items())),
    }


def stratified_split(
    records: list[DatasetRecord],
    val_fraction: float = 0.15,
    test_fraction: float = 0.2,
    seed: int = RANDOM_SEED,
) -> tuple[list[DatasetRecord], list[DatasetRecord], list[DatasetRecord]]:
    """Deterministic per-category split (default 65/15/20 by per-category rounding).

    With 8 samples per category this yields 5 train / 1 val / 2 test per category.
    """
    import random

    rng = random.Random(seed)  # noqa: S311 - deterministic academic split, not crypto
    train: list[DatasetRecord] = []
    val: list[DatasetRecord] = []
    test: list[DatasetRecord] = []
    by_cat: dict[str, list[DatasetRecord]] = {}
    for rec in records:
        by_cat.setdefault(rec.category, []).append(rec)
    for category in sorted(by_cat):
        items = sorted(by_cat[category], key=lambda r: r.id)
        rng.shuffle(items)
        n = len(items)
        n_test = max(1, round(n * test_fraction)) if n >= 3 else 0
        n_val = max(1, round(n * val_fraction)) if n >= 3 else 0
        test.extend(items[:n_test])
        val.extend(items[n_test : n_test + n_val])
        train.extend(items[n_test + n_val :])
    return train, val, test
