"""Configurable fusion of rule, ML and acoustic signals into one explainable score."""

from __future__ import annotations

from dataclasses import dataclass

from vishield.domain.models import (
    ComponentScores,
    FeatureContribution,
    Indicator,
    RiskLevel,
)


@dataclass(frozen=True)
class RiskWeights:
    rules: float = 0.4
    ml: float = 0.5
    acoustic: float = 0.1


@dataclass(frozen=True)
class RiskThresholds:
    medium: int = 35
    high: int = 65


@dataclass(frozen=True)
class RiskAssessment:
    score: int
    level: RiskLevel
    confidence: float
    components: ComponentScores


def fuse(
    rule_score: float,
    ml_probability: float | None,
    acoustic_score: float | None,
    weights: RiskWeights,
    thresholds: RiskThresholds,
    synthetic_voice_score: float | None = None,
) -> RiskAssessment:
    """Weighted average over the components that are actually available.

    Missing components (no ML model loaded, no audio) are dropped and the remaining
    weights are renormalised, so a transcript-only run still yields a sensible score.
    """
    parts: list[tuple[str, float, float]] = [("rules", rule_score, weights.rules)]
    if ml_probability is not None:
        parts.append(("ml", ml_probability, weights.ml))
    if acoustic_score is not None:
        parts.append(("acoustic", acoustic_score, weights.acoustic))

    total_weight = sum(w for _, _, w in parts)
    if total_weight <= 0:
        used = {name: 1.0 / len(parts) for name, _, _ in parts}
    else:
        used = {name: w / total_weight for name, _, w in parts}

    fused = sum(value * used[name] for name, value, _ in parts)
    score = max(0, min(100, round(fused * 100)))
    level = _level_for(score, thresholds)
    confidence = _confidence(rule_score, ml_probability, acoustic_score, score)

    components = ComponentScores(
        rule_score=round(rule_score, 4),
        ml_probability=None if ml_probability is None else round(ml_probability, 4),
        acoustic_score=None if acoustic_score is None else round(acoustic_score, 4),
        synthetic_voice_score=(
            None if synthetic_voice_score is None else round(synthetic_voice_score, 4)
        ),
        weights_used={k: round(v, 4) for k, v in used.items()},
    )
    return RiskAssessment(score=score, level=level, confidence=confidence, components=components)


def _level_for(score: int, thresholds: RiskThresholds) -> RiskLevel:
    if score >= thresholds.high:
        return RiskLevel.HIGH
    if score >= thresholds.medium:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


def _confidence(
    rule_score: float, ml_probability: float | None, acoustic_score: float | None, score: int
) -> float:
    """Heuristic confidence: distance from the midpoint plus component agreement.

    This is *not* a calibrated probability; it is a transparency aid for the reviewer.
    """
    decisiveness = abs(score - 50) / 50.0
    values = [rule_score] + [v for v in (ml_probability, acoustic_score) if v is not None]
    if len(values) > 1:
        spread = max(values) - min(values)
        agreement = 1.0 - min(1.0, spread)
    else:
        agreement = 0.5  # a single signal earns only moderate confidence
    return round(max(0.05, min(0.99, 0.6 * decisiveness + 0.4 * agreement)), 3)


def explain(
    assessment: RiskAssessment,
    indicators: list[Indicator],
    top_features: list[FeatureContribution],
    acoustic_note: str | None = None,
) -> str:
    """Compose a plain-language explanation that never overclaims."""
    lines: list[str] = []
    level = assessment.level.value.upper()
    lines.append(
        f"Overall risk {assessment.score}/100 ({level}). Potential phishing indicators "
        "detected by rules and a small text classifier; this result requires human review."
    )
    if indicators:
        names = ", ".join(i.title.lower() for i in indicators[:4])
        lines.append(f"Strongest indicator families: {names}.")
        strongest = indicators[0]
        if strongest.evidence:
            quotes = "; ".join(f'"{e.text}"' for e in strongest.evidence[:3])
            lines.append(f"Example phrases: {quotes}.")
    else:
        lines.append("No rule-based indicators fired.")

    comp = assessment.components
    if comp.ml_probability is not None:
        lines.append(
            f"Text classifier probability of phishing: {comp.ml_probability:.2f} "
            f"(weight {comp.weights_used.get('ml', 0):.2f})."
        )
        if top_features:
            feats = ", ".join(f"'{f.feature}'" for f in top_features[:5])
            lines.append(f"Most influential text features: {feats}.")
    else:
        lines.append("No trained text classifier was available; score relies on rules only.")
    if comp.acoustic_score is not None:
        lines.append(
            f"Acoustic score {comp.acoustic_score:.2f} contributed with weight "
            f"{comp.weights_used.get('acoustic', 0):.2f}."
        )
    if comp.synthetic_voice_score is not None:
        lines.append(
            f"Synthetic-voice score {comp.synthetic_voice_score:.2f} is experimental and may be "
            "inaccurate; it does not prove the audio is AI-generated."
        )
    if acoustic_note:
        lines.append(acoustic_note)
    lines.append(
        f"Reviewer confidence aid: {assessment.confidence:.2f} (heuristic, not calibrated)."
    )
    return " ".join(lines)
