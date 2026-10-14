"""Persistence of anonymised analysis metadata."""

from __future__ import annotations

import hashlib

from sqlalchemy import func, select

from vishield.domain.models import AnalysisResult
from vishield.infra.db import AnalysisRecord, Database


class AnalysisRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def save(self, result: AnalysisResult, stt_backend: str | None = None) -> None:
        record = AnalysisRecord(
            analysis_id=result.analysis_id,
            created_at=result.created_at,
            input_kind=result.input_kind,
            model_version=result.model_version,
            stt_backend=stt_backend,
            processing_ms=result.processing_ms,
            risk_score=result.risk_score,
            risk_level=result.risk_level.value,
            confidence=result.confidence,
            rule_score=result.components.rule_score,
            ml_probability=result.components.ml_probability,
            acoustic_score=result.components.acoustic_score,
            indicator_categories=",".join(i.category.value for i in result.indicators),
            redaction_total=sum(result.redaction_counts.values()),
            transcript_sha256=hashlib.sha256(result.redacted_transcript.encode()).hexdigest(),
            duration_seconds=result.acoustic.duration_seconds if result.acoustic else None,
        )
        with self.db.session() as session:
            session.add(record)

    def count(self) -> int:
        with self.db.session() as session:
            return int(session.scalar(select(func.count(AnalysisRecord.id))) or 0)

    def recent(self, limit: int = 20) -> list[AnalysisRecord]:
        with self.db.session() as session:
            stmt = select(AnalysisRecord).order_by(AnalysisRecord.created_at.desc()).limit(limit)
            return list(session.scalars(stmt).all())

    def level_counts(self) -> dict[str, int]:
        with self.db.session() as session:
            stmt = select(AnalysisRecord.risk_level, func.count()).group_by(
                AnalysisRecord.risk_level
            )
            return {str(level): int(n) for level, n in session.execute(stmt).all()}
