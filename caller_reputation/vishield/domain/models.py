"""Typed schemas shared by the domain, API and dashboard layers."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class RiskLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class IndicatorCategory(StrEnum):
    """Social-engineering indicator families detected by the rule engine."""

    URGENCY = "urgency"
    AUTHORITY = "authority"
    FEAR_THREAT = "fear_threat"
    CREDENTIAL_REQUEST = "credential_request"
    PAYMENT_REQUEST = "payment_request"
    SECRECY = "secrecy"
    SUSPICIOUS_CONTACT = "suspicious_contact"
    REMOTE_ACCESS = "remote_access"
    TRUST_BUILDING = "trust_building"


class EvidenceSpan(BaseModel):
    """A slice of the (redacted) transcript that supports an indicator."""

    text: str
    start: int = Field(ge=0)
    end: int = Field(ge=0)
    rule_id: str


class Indicator(BaseModel):
    """One detected indicator family with its supporting evidence."""

    category: IndicatorCategory
    title: str
    description: str
    severity: float = Field(ge=0, le=1)
    hits: int = Field(ge=0)
    evidence: list[EvidenceSpan] = Field(default_factory=list)


class FeatureContribution(BaseModel):
    """An influential text feature from the explainable ML model."""

    feature: str
    weight: float
    direction: str = Field(pattern="^(phishing|legitimate)$")


class ComponentScores(BaseModel):
    """Individual component scores before fusion (all in [0, 1])."""

    rule_score: float = Field(ge=0, le=1)
    ml_probability: float | None = Field(default=None, ge=0, le=1)
    acoustic_score: float | None = Field(default=None, ge=0, le=1)
    synthetic_voice_score: float | None = Field(default=None, ge=0, le=1)
    weights_used: dict[str, float] = Field(default_factory=dict)


class AcousticSummary(BaseModel):
    """Non-identifying acoustic statistics of the analysed audio."""

    duration_seconds: float
    sample_rate: int
    speech_ratio: float = Field(ge=0, le=1)
    pause_count: int = Field(ge=0)
    mean_pause_seconds: float = Field(ge=0)
    speaking_rate_proxy: float = Field(ge=0, description="syllable-like onsets per second")
    pitch_mean_hz: float | None = None
    pitch_std_hz: float | None = None
    spectral_centroid_mean: float
    spectral_flatness_mean: float
    rms_mean: float


class AnalysisResult(BaseModel):
    """Full explainable output for one transcript or audio sample."""

    analysis_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(tz=UTC))
    model_version: str
    processing_ms: int = Field(ge=0)
    input_kind: str = Field(pattern="^(transcript|audio)$")

    risk_score: int = Field(ge=0, le=100)
    risk_level: RiskLevel
    confidence: float = Field(ge=0, le=1)

    redacted_transcript: str
    redaction_counts: dict[str, int] = Field(default_factory=dict)

    indicators: list[Indicator] = Field(default_factory=list)
    top_features: list[FeatureContribution] = Field(default_factory=list)
    components: ComponentScores
    acoustic: AcousticSummary | None = None

    explanation: str
    recommendations: list[str] = Field(default_factory=list)
    disclaimer: str = (
        "Potential phishing indicators detected by an academic prototype. "
        "This result requires human review and is not proof that a caller is malicious."
    )


class TranscriptAnalysisRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=20_000)
    consent_confirmed: bool = Field(
        default=True,
        description="Caller confirms the text is synthetic, public or explicitly consented.",
    )


class BatchItem(BaseModel):
    id: str
    transcript: str = Field(min_length=1, max_length=20_000)
    label: str | None = Field(default=None, pattern="^(phishing|legitimate)$")


class BatchEvaluateRequest(BaseModel):
    items: list[BatchItem] = Field(min_length=1, max_length=500)


class MetricsReport(BaseModel):
    n: int
    accuracy: float | None = None
    precision: float | None = None
    recall: float | None = None
    f1: float | None = None
    roc_auc: float | None = None
    confusion_matrix: list[list[int]] | None = Field(
        default=None, description="[[TN, FP], [FN, TP]] with 'phishing' as positive class"
    )
    labels_present: bool = False


class BatchItemResult(BaseModel):
    id: str
    risk_score: int
    risk_level: RiskLevel
    predicted_label: str
    true_label: str | None = None


class BatchEvaluateResponse(BaseModel):
    results: list[BatchItemResult]
    metrics: MetricsReport
    model_version: str


class ModelInfo(BaseModel):
    model_version: str
    ml_model_loaded: bool
    ml_model_type: str
    ml_model_path: str | None
    stt_backend: str
    streaming_stt_available: bool = True
    rule_count: int
    weights: dict[str, float]
    thresholds: dict[str, int]
    synthetic_voice_signal_enabled: bool
    transformer_classifier_enabled: bool
    trained_on: str | None = None


class SafetyPolicy(BaseModel):
    purpose: str
    permitted_uses: list[str]
    prohibited_uses: list[str]
    data_handling: list[str]
    disclaimer: str


class HealthResponse(BaseModel):
    status: str
    version: str
    model_loaded: bool
    stt_backend: str
    streaming_stt_available: bool = True
    timestamp: datetime


class CallUploadResponse(BaseModel):
    call_id: str


class CallTranscriptResponse(BaseModel):
    call_id: str
    context: str
    chunks: list[TranscriptChunk]



class AudioChunk(BaseModel):
    """Audio slice consumed by streaming STT and the voice-authenticity (AASIST) stage."""

    call_id: str
    chunk_id: int  # 0-based, contiguous
    pcm: bytes  # 16 kHz, mono, 16-bit little-endian PCM
    start_ms: int
    end_ms: int


class TranscriptChunk(BaseModel):
    """The official output contract of the streaming speech-to-text ingestion layer.

    Fields are strictly pinned:
      - call_id: unique identifier of the call session
      - chunk_id: 0-based index of the audio chunk producing this transcript
      - text: recognised (and potentially redacted) speech transcript for this chunk
      - language: detected language tag ("hi-IN" | "en-IN" | "hinglish")
      - timestamp: seconds from call start, chosen as a floating-point seconds value
        to conform to standard media timeline representations and audio segment offsets.
    """

    call_id: str
    chunk_id: int
    text: str
    language: str  # "hi-IN" | "en-IN" | "hinglish"
    timestamp: float

