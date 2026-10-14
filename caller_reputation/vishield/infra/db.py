"""SQLAlchemy models and session factory. Only anonymised metadata is stored."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


class AnalysisRecord(Base):
    """Anonymised result metadata. No transcript, no audio, no identifiers."""

    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analysis_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(tz=UTC), index=True
    )
    input_kind: Mapped[str] = mapped_column(String(16))
    model_version: Mapped[str] = mapped_column(String(64))
    stt_backend: Mapped[str | None] = mapped_column(String(64), nullable=True)
    processing_ms: Mapped[int] = mapped_column(Integer)
    risk_score: Mapped[int] = mapped_column(Integer, index=True)
    risk_level: Mapped[str] = mapped_column(String(8), index=True)
    confidence: Mapped[float] = mapped_column(Float)
    rule_score: Mapped[float] = mapped_column(Float)
    ml_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    acoustic_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    indicator_categories: Mapped[str] = mapped_column(Text, default="")
    redaction_total: Mapped[int] = mapped_column(Integer, default=0)
    transcript_sha256: Mapped[str] = mapped_column(String(64))
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)


def make_engine(database_url: str) -> Engine:
    if database_url in {"sqlite://", "sqlite:///:memory:"}:
        return create_engine(
            database_url, connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
    if database_url.startswith("sqlite"):
        return create_engine(database_url, connect_args={"check_same_thread": False})
    return create_engine(database_url)


def init_db(engine: Engine) -> None:
    Base.metadata.create_all(engine)


class Database:
    def __init__(self, database_url: str) -> None:
        self.engine = make_engine(database_url)
        init_db(self.engine)
        self._factory = sessionmaker(bind=self.engine, expire_on_commit=False)

    @contextmanager
    def session(self) -> Iterator[Session]:
        session = self._factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
