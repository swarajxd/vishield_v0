"""Baseline B: TF-IDF + logistic regression with per-prediction feature attributions."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np

from vishield import MODEL_VERSION
from vishield.config import RANDOM_SEED
from vishield.domain.models import FeatureContribution

log = logging.getLogger(__name__)

POSITIVE_LABEL = "phishing"


class ModelLoadError(RuntimeError):
    pass


@dataclass
class TrainingMetadata:
    model_version: str = MODEL_VERSION
    trained_at: str = field(default_factory=lambda: datetime.now(tz=UTC).isoformat())
    n_train: int = 0
    n_features: int = 0
    dataset_sha256: str | None = None
    notes: str = "TF-IDF(1-2gram, sublinear) + LogisticRegression(class_weight=balanced)"


class PhishingClassifier:
    """Explainable text classifier. ``predict_proba`` returns P(phishing)."""

    model_type = "tfidf+logreg"

    def __init__(self, c: float = 2.0, max_features: int = 20_000) -> None:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import Pipeline

        self.pipeline = Pipeline(
            [
                (
                    "tfidf",
                    TfidfVectorizer(
                        ngram_range=(1, 2),
                        sublinear_tf=True,
                        min_df=1,
                        max_features=max_features,
                        lowercase=True,
                        strip_accents="unicode",
                    ),
                ),
                (
                    "clf",
                    LogisticRegression(
                        C=c,
                        class_weight="balanced",
                        max_iter=1000,
                        random_state=RANDOM_SEED,
                    ),
                ),
            ]
        )
        self.metadata = TrainingMetadata()

    # -- training ---------------------------------------------------------------------------
    def fit(self, texts: list[str], labels: list[str], dataset_sha256: str | None = None) -> None:
        y = np.array([1 if lbl == POSITIVE_LABEL else 0 for lbl in labels])
        if len(set(y.tolist())) < 2:
            raise ValueError("training data must contain both classes")
        self.pipeline.fit(texts, y)
        self.metadata = TrainingMetadata(
            n_train=len(texts),
            n_features=len(self._vectorizer.get_feature_names_out()),
            dataset_sha256=dataset_sha256,
        )

    # -- inference --------------------------------------------------------------------------
    @property
    def _vectorizer(self) -> Any:
        return self.pipeline.named_steps["tfidf"]

    @property
    def _clf(self) -> Any:
        return self.pipeline.named_steps["clf"]

    def predict_proba(self, text: str) -> float:
        proba = self.pipeline.predict_proba([text])[0]
        return float(proba[1])

    def predict_proba_batch(self, texts: list[str]) -> list[float]:
        if not texts:
            return []
        return [float(p[1]) for p in self.pipeline.predict_proba(texts)]

    def explain(self, text: str, top_k: int = 8) -> list[FeatureContribution]:
        """Per-feature contribution = tf-idf value * coefficient for features present in text."""
        vec = self._vectorizer.transform([text])
        coef = self._clf.coef_[0]
        names = self._vectorizer.get_feature_names_out()
        indices = vec.indices
        values = vec.data
        contributions = [(names[i], float(values[j] * coef[i])) for j, i in enumerate(indices)]
        contributions.sort(key=lambda c: abs(c[1]), reverse=True)
        return [
            FeatureContribution(
                feature=str(name),
                weight=round(weight, 4),
                direction="phishing" if weight > 0 else "legitimate",
            )
            for name, weight in contributions[:top_k]
            if abs(weight) > 1e-6
        ]

    def global_top_features(self, top_k: int = 15) -> dict[str, list[tuple[str, float]]]:
        coef = self._clf.coef_[0]
        names = self._vectorizer.get_feature_names_out()
        order = np.argsort(coef)
        return {
            "phishing": [(str(names[i]), round(float(coef[i]), 4)) for i in order[::-1][:top_k]],
            "legitimate": [(str(names[i]), round(float(coef[i]), 4)) for i in order[:top_k]],
        }

    # -- persistence ------------------------------------------------------------------------
    def save(self, path: Path) -> None:
        import joblib

        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"pipeline": self.pipeline, "metadata": self.metadata.__dict__}, path)

    @classmethod
    def load(cls, path: Path) -> PhishingClassifier:
        import joblib

        if not path.exists():
            raise ModelLoadError(f"model file not found: {path}")
        try:
            payload = joblib.load(path)
            instance = cls()
            instance.pipeline = payload["pipeline"]
            instance.metadata = TrainingMetadata(**payload["metadata"])
        except (KeyError, TypeError, ValueError, EOFError, OSError) as exc:
            raise ModelLoadError(f"corrupt model file {path}: {exc.__class__.__name__}") from exc
        except Exception as exc:
            raise ModelLoadError(f"could not load {path}: {exc.__class__.__name__}") from exc
        return instance


def load_or_none(path: Path) -> PhishingClassifier | None:
    """Load the model if possible; log and return None so the service degrades to rules-only."""
    try:
        return PhishingClassifier.load(path)
    except ModelLoadError as exc:
        log.warning("ML model unavailable (%s); running rules-only", exc)
        return None
