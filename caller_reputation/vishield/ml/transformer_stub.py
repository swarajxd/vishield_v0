"""Optional research extension: a replaceable transformer classifier. DISABLED by default.

Enabling requires ``pip install -e '.[research]'`` and setting
``VISHIELD_ENABLE_TRANSFORMER_CLASSIFIER=true``.
The class only imports heavy libraries when instantiated, so CI and laptops never pay for it.
No pretrained weights are bundled; you must fine-tune on consented/synthetic data and
document results honestly in docs/EXPERIMENTS.md.
"""

from __future__ import annotations

from typing import Any, Protocol


class TextProbabilityModel(Protocol):
    """Anything that maps a transcript to P(phishing)."""

    model_type: str

    def predict_proba(self, text: str) -> float: ...


class TransformerClassifier:
    model_type = "transformer(experimental)"

    def __init__(self, model_name_or_path: str) -> None:
        try:
            from transformers import pipeline as hf_pipeline
        except ImportError as exc:
            raise RuntimeError(
                "transformers/torch not installed; run `pip install -e '.[research]'`"
            ) from exc
        self._pipe: Any = hf_pipeline("text-classification", model=model_name_or_path)

    def predict_proba(self, text: str) -> float:
        out = self._pipe(text[:2000], truncation=True)[0]
        label = str(out.get("label", "")).lower()
        score = float(out.get("score", 0.0))
        return score if "phish" in label or label.endswith("1") else 1.0 - score
