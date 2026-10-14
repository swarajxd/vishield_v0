"""AnalysisService: the single entry point used by both the API and the dashboard."""

from __future__ import annotations

import logging
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

from vishield import MODEL_VERSION
from vishield.audio.features import acoustic_pressure_score, extract_features
from vishield.audio.normalize import DecodeError, load_and_normalize
from vishield.audio.synthetic_voice import (
    DisabledSyntheticVoiceDetector,
    HeuristicSyntheticVoiceDetector,
    SyntheticVoiceDetector,
)
from vishield.audio.validation import AudioValidationError, validate_duration, validate_upload
from vishield.config import Settings
from vishield.domain.models import (
    AcousticSummary,
    AnalysisResult,
    BatchEvaluateResponse,
    BatchItem,
    BatchItemResult,
    FeatureContribution,
    ModelInfo,
    RiskLevel,
)
from vishield.domain.recommendations import recommend
from vishield.domain.redaction import redact
from vishield.domain.risk_engine import RiskThresholds, RiskWeights, explain, fuse
from vishield.domain.rules import build_indicators, detect_hits, rule_count, rule_score
from vishield.infra import metrics
from vishield.ml.classifier import PhishingClassifier, load_or_none
from vishield.ml.evaluate import compute_metrics
from vishield.stt import SpeechToText, build_stt

log = logging.getLogger(__name__)


class EmptyTranscriptError(ValueError):
    """Raised when the transcript is blank after normalisation."""


class AnalysisService:
    def __init__(
        self,
        settings: Settings,
        classifier: PhishingClassifier | None = None,
        stt: SpeechToText | None = None,
        repository: object | None = None,
        load_model: bool = True,
    ) -> None:
        self.settings = settings
        self.classifier = classifier
        if self.classifier is None and load_model:
            self.classifier = load_or_none(settings.model_path)
        self.stt = stt or build_stt(settings)
        self.repository = repository
        self.synthetic_detector: SyntheticVoiceDetector = (
            HeuristicSyntheticVoiceDetector()
            if settings.enable_synthetic_voice_signal
            else DisabledSyntheticVoiceDetector()
        )
        self.weights = RiskWeights(
            rules=settings.weight_rules, ml=settings.weight_ml, acoustic=settings.weight_acoustic
        )
        self.thresholds = RiskThresholds(
            medium=settings.risk_medium_threshold, high=settings.risk_high_threshold
        )
        metrics.set_model_state(
            self.classifier is not None,
            self.classifier.model_type if self.classifier else "none",
            self.stt.name,
        )

    # -- public API -------------------------------------------------------------------------
    def analyze_transcript(self, transcript: str) -> AnalysisResult:
        started = time.perf_counter()
        result = self._analyze_text(transcript, input_kind="transcript", acoustic=None)
        result.processing_ms = int((time.perf_counter() - started) * 1000)
        self._persist(result)
        metrics.record_analysis(result)
        return result

    def analyze_audio(
        self, data: bytes, filename: str | None, content_type: str | None
    ) -> AnalysisResult:
        started = time.perf_counter()
        meta = validate_upload(filename, content_type, data, self.settings)
        try:
            audio = load_and_normalize(data, meta.extension, self.settings.target_sample_rate)
        except DecodeError as exc:
            raise AudioValidationError("undecodable", str(exc)) from exc
        validate_duration(audio.duration_seconds, self.settings)

        self._maybe_store_dev_audio(data, meta.extension)

        summary = extract_features(audio.samples, audio.sample_rate)
        transcription = self.stt.transcribe(audio.samples, audio.sample_rate)
        del audio  # raw samples are not needed beyond this point
        result = self._analyze_text(transcription.text, input_kind="audio", acoustic=summary)
        result.processing_ms = int((time.perf_counter() - started) * 1000)
        self._persist(result, stt_backend=transcription.backend)
        metrics.record_analysis(result)
        return result

    def evaluate_batch(self, items: list[BatchItem]) -> BatchEvaluateResponse:
        results: list[BatchItemResult] = []
        y_true: list[str] = []
        y_pred: list[str] = []
        y_score: list[float] = []
        for item in items:
            try:
                analysis = self._analyze_text(
                    item.transcript, input_kind="transcript", acoustic=None
                )
            except EmptyTranscriptError:
                continue
            predicted = "phishing" if analysis.risk_level != RiskLevel.LOW else "legitimate"
            results.append(
                BatchItemResult(
                    id=item.id,
                    risk_score=analysis.risk_score,
                    risk_level=analysis.risk_level,
                    predicted_label=predicted,
                    true_label=item.label,
                )
            )
            if item.label is not None:
                y_true.append(item.label)
                y_pred.append(predicted)
                y_score.append(analysis.risk_score / 100.0)
        metrics_report = (
            compute_metrics(y_true, y_pred, y_score) if y_true else compute_metrics([], [])
        )
        metrics_report.n = len(y_true)
        metrics.record_batch(metrics_report)
        return BatchEvaluateResponse(
            results=results, metrics=metrics_report, model_version=MODEL_VERSION
        )

    def model_info(self) -> ModelInfo:
        return ModelInfo(
            model_version=MODEL_VERSION,
            ml_model_loaded=self.classifier is not None,
            ml_model_type=self.classifier.model_type if self.classifier else "none (rules-only)",
            ml_model_path=str(self.settings.model_path) if self.classifier else None,
            stt_backend=self.stt.name,
            rule_count=rule_count(),
            weights={
                "rules": self.weights.rules,
                "ml": self.weights.ml,
                "acoustic": self.weights.acoustic,
            },
            thresholds={"medium": self.thresholds.medium, "high": self.thresholds.high},
            synthetic_voice_signal_enabled=self.settings.enable_synthetic_voice_signal,
            transformer_classifier_enabled=self.settings.enable_transformer_classifier,
            trained_on=self.classifier.metadata.trained_at if self.classifier else None,
        )

    # -- internals --------------------------------------------------------------------------
    def _analyze_text(
        self, transcript: str, input_kind: str, acoustic: AcousticSummary | None
    ) -> AnalysisResult:
        text = " ".join(transcript.split())
        if not text:
            raise EmptyTranscriptError("Transcript is empty after normalisation.")

        redaction = redact(text)
        hits = detect_hits(redaction.text)
        r_score = rule_score(hits, self.settings.rule_saturation_weight)
        indicators = build_indicators(hits)

        ml_prob: float | None = None
        top_features: list[FeatureContribution] = []
        if self.classifier is not None:
            ml_prob = self.classifier.predict_proba(redaction.text)
            top_features = self.classifier.explain(redaction.text)

        acoustic_score: float | None = None
        synthetic_score: float | None = None
        acoustic_note: str | None = None
        if acoustic is not None:
            acoustic_score = acoustic_pressure_score(acoustic)
            if self.settings.enable_synthetic_voice_signal:
                synthetic_score = self.synthetic_detector.score(acoustic)
            acoustic_note = (
                f"Audio summary: {acoustic.duration_seconds:.1f}s, {acoustic.pause_count} pauses, "
                f"speaking-rate proxy {acoustic.speaking_rate_proxy:.1f} onsets/s."
            )

        assessment = fuse(
            r_score, ml_prob, acoustic_score, self.weights, self.thresholds, synthetic_score
        )
        explanation = explain(assessment, indicators, top_features, acoustic_note)
        recommendations = recommend(assessment.level, [i.category for i in indicators])

        return AnalysisResult(
            analysis_id=str(uuid.uuid4()),
            created_at=datetime.now(tz=UTC),
            model_version=MODEL_VERSION,
            processing_ms=0,
            input_kind=input_kind,
            risk_score=assessment.score,
            risk_level=assessment.level,
            confidence=assessment.confidence,
            redacted_transcript=redaction.text,
            redaction_counts=redaction.counts,
            indicators=indicators,
            top_features=top_features,
            components=assessment.components,
            acoustic=acoustic,
            explanation=explanation,
            recommendations=recommendations,
        )

    def _persist(self, result: AnalysisResult, stt_backend: str | None = None) -> None:
        if self.repository is None:
            return
        try:
            self.repository.save(result, stt_backend)  # type: ignore[attr-defined]
        except Exception:
            log.exception("failed to persist analysis metadata")

    def _maybe_store_dev_audio(self, data: bytes, extension: str) -> None:
        if not self.settings.dev_store_audio or self.settings.env == "production":
            return
        target_dir = Path(self.settings.dev_audio_dir)
        target_dir.mkdir(parents=True, exist_ok=True)
        path = target_dir / f"{uuid.uuid4()}{extension}"
        path.write_bytes(data)
        log.warning("DEV ONLY: stored raw audio at %s", path)
