"""Prometheus metrics. Only anonymised aggregates: no transcript text, no identifiers."""

from __future__ import annotations

import time
from collections.abc import Awaitable, Callable

from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram
from starlette.requests import Request
from starlette.responses import Response

from vishield import MODEL_VERSION
from vishield.domain.models import AnalysisResult, MetricsReport

REGISTRY = CollectorRegistry(auto_describe=True)

_SCORE_BUCKETS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
_PROB_BUCKETS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
_LATENCY_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]

ANALYSES = Counter(
    "vishield_analyses_total",
    "Completed analyses by input kind and risk level",
    ["input_kind", "risk_level"],
    registry=REGISTRY,
)
PROCESSING = Histogram(
    "vishield_processing_seconds",
    "End-to-end analysis time",
    ["input_kind"],
    buckets=_LATENCY_BUCKETS,
    registry=REGISTRY,
)
RISK_SCORE = Histogram(
    "vishield_risk_score",
    "Distribution of overall risk scores (0-100)",
    ["input_kind"],
    buckets=_SCORE_BUCKETS,
    registry=REGISTRY,
)
INGEST_CHUNK_LATENCY = Histogram(
    "vishield_ingest_chunk_latency_seconds",
    "Per-chunk latency from audio chunk push to transcript chunk emission",
    buckets=_LATENCY_BUCKETS,
    registry=REGISTRY,
)

RULE_SCORE = Histogram(
    "vishield_rule_score", "Rule-engine score (0-1)", buckets=_PROB_BUCKETS, registry=REGISTRY
)
ML_PROBABILITY = Histogram(
    "vishield_ml_probability",
    "Classifier probability of phishing (0-1)",
    buckets=_PROB_BUCKETS,
    registry=REGISTRY,
)
CONFIDENCE = Histogram(
    "vishield_confidence", "Reviewer confidence aid (0-1)", buckets=_PROB_BUCKETS, registry=REGISTRY
)
INDICATORS = Counter(
    "vishield_indicators_total",
    "Indicator families detected",
    ["category"],
    registry=REGISTRY,
)
REDACTIONS = Counter(
    "vishield_redactions_total", "Values redacted before persistence", ["kind"], registry=REGISTRY
)
AUDIO_DURATION = Histogram(
    "vishield_audio_duration_seconds",
    "Duration of analysed audio",
    buckets=[1, 2, 5, 10, 20, 30, 60, 120, 180],
    registry=REGISTRY,
)
ERRORS = Counter(
    "vishield_errors_total",
    "Rejected or failed requests by error code",
    ["code"],
    registry=REGISTRY,
)
MODEL_LOADED = Gauge("vishield_model_loaded", "1 if the ML model is loaded", registry=REGISTRY)
MODEL_INFO = Gauge(
    "vishield_model_info",
    "Static model metadata (value is always 1)",
    ["model_version", "model_type", "stt_backend"],
    registry=REGISTRY,
)
BATCH_EVALUATIONS = Counter(
    "vishield_batch_evaluations_total", "Batch evaluation runs", registry=REGISTRY
)
BATCH_METRIC = Gauge(
    "vishield_batch_metric",
    "Metrics from the most recent labelled batch evaluation",
    ["metric"],
    registry=REGISTRY,
)
BATCH_ITEMS = Gauge(
    "vishield_batch_last_items", "Items in the most recent batch evaluation", registry=REGISTRY
)
HTTP_REQUESTS = Counter(
    "vishield_http_requests_total",
    "HTTP requests by route and status",
    ["method", "route", "status"],
    registry=REGISTRY,
)
HTTP_LATENCY = Histogram(
    "vishield_http_request_seconds",
    "HTTP request latency by route",
    ["method", "route"],
    buckets=_LATENCY_BUCKETS,
    registry=REGISTRY,
)


def record_analysis(result: AnalysisResult) -> None:
    kind = result.input_kind
    ANALYSES.labels(kind, result.risk_level.value).inc()
    PROCESSING.labels(kind).observe(result.processing_ms / 1000.0)
    RISK_SCORE.labels(kind).observe(result.risk_score)
    RULE_SCORE.observe(result.components.rule_score)
    CONFIDENCE.observe(result.confidence)
    if result.components.ml_probability is not None:
        ML_PROBABILITY.observe(result.components.ml_probability)
    for indicator in result.indicators:
        INDICATORS.labels(indicator.category.value).inc()
    for redaction_kind, count in result.redaction_counts.items():
        REDACTIONS.labels(redaction_kind).inc(count)
    if result.acoustic is not None:
        AUDIO_DURATION.observe(result.acoustic.duration_seconds)


def record_batch(report: MetricsReport) -> None:
    BATCH_EVALUATIONS.inc()
    BATCH_ITEMS.set(report.n)
    if report.labels_present:
        for name in ("accuracy", "precision", "recall", "f1", "roc_auc"):
            value = getattr(report, name)
            if value is not None:
                BATCH_METRIC.labels(name).set(value)


def record_error(code: str) -> None:
    ERRORS.labels(code).inc()


def record_chunk_latency(seconds: float) -> None:
    INGEST_CHUNK_LATENCY.observe(seconds)



def set_model_state(loaded: bool, model_type: str, stt_backend: str) -> None:
    MODEL_LOADED.set(1 if loaded else 0)
    MODEL_INFO.labels(MODEL_VERSION, model_type, stt_backend).set(1)


async def http_metrics_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Starlette middleware: per-route counters and latency (route template, not raw path)."""
    started = time.perf_counter()
    response = await call_next(request)
    route = request.scope.get("route")
    template = getattr(route, "path", request.url.path)
    if template in {"/metrics", "/docs", "/openapi.json", "/redoc", "/favicon.ico"}:
        return response
    HTTP_REQUESTS.labels(request.method, template, str(response.status_code)).inc()
    HTTP_LATENCY.labels(request.method, template).observe(time.perf_counter() - started)
    return response
