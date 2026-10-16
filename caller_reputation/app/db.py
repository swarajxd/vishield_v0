"""Layer 2 storage: aggregated scam-number table + per-report log + whitelist + source traces + scrape logs + incidents."""
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text, UniqueConstraint, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from .config import DATABASE_URL


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)  # naive UTC, works on SQLite + Postgres


class Base(DeclarativeBase):
    pass


class ScamNumber(Base):
    __tablename__ = "scam_numbers"
    number_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    report_count: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped[str] = mapped_column(String(40), default="other")
    first_reported: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_reported: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    source: Mapped[str] = mapped_column(String(40), default="community")


class ReportLog(Base):
    """One row per user report; the unique constraint stops one user re-flagging a number."""
    __tablename__ = "report_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    number_hash: Mapped[str] = mapped_column(String(64), index=True)
    reporter_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    __table_args__ = (UniqueConstraint("number_hash", "reporter_hash"),)


class Whitelist(Base):
    __tablename__ = "whitelist"
    number_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    label: Mapped[str] = mapped_column(String(80), default="")


class NumberSource(Base):
    """Trace of which external sources/topics flagged this number hash."""
    __tablename__ = "number_sources"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    number_hash: Mapped[str] = mapped_column(String(64), index=True)
    source: Mapped[str] = mapped_column(String(40))  # e.g. "community", "scammer.info", "seed"
    topic_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    __table_args__ = (UniqueConstraint("number_hash", "source", "topic_id", name="uq_number_source_topic"),)


class ScrapeLog(Base):
    """Log of topics scraped from external forums to avoid re-fetching unchanged topics."""
    __tablename__ = "scrape_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    topic_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    last_bumped_at: Mapped[str | None] = mapped_column(String(80), nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Incident(Base):
    """Stores every pipeline evaluation result for the Incident History / Post-Call Audit Log."""
    __tablename__ = "incidents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    call_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    timestamp: Mapped[str] = mapped_column(String(60))
    caller_number_raw: Mapped[str] = mapped_column(String(30))
    caller_number_masked: Mapped[str] = mapped_column(String(30))
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    detected_language: Mapped[str] = mapped_column(String(20), default="en")
    conversation_score: Mapped[float] = mapped_column(Float, default=0.0)
    aasist_score: Mapped[float] = mapped_column(Float, default=0.0)
    reputation_score: Mapped[float] = mapped_column(Float, default=0.0)
    final_risk: Mapped[float] = mapped_column(Float, default=0.0)
    classification: Mapped[str] = mapped_column(String(20), default="SAFE")
    detected_indicators: Mapped[str] = mapped_column(Text, default="")  # JSON array string
    guardian_status: Mapped[str] = mapped_column(String(120), default="NOT_TRIGGERED")
    transcript: Mapped[str] = mapped_column(Text, default="")
    audio_file: Mapped[str] = mapped_column(String(255), default="")
    full_result_json: Mapped[str] = mapped_column(Text, default="{}")  # full pipeline JSON
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


_kwargs = {"connect_args": {"check_same_thread": False}} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, **_kwargs)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def init_db() -> None:
    Base.metadata.create_all(engine)
