"""Metric computation for individual predictors and the hybrid pipeline."""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from vishield.domain.models import MetricsReport


def compute_metrics(
    y_true: Sequence[str], y_pred: Sequence[str], y_score: Sequence[float] | None = None
) -> MetricsReport:
    """Binary metrics with 'phishing' as the positive class. Handles degenerate inputs."""
    from sklearn.metrics import (
        accuracy_score,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
    )

    n = len(y_true)
    if n == 0:
        return MetricsReport(n=0, labels_present=False)
    t = np.array([1 if v == "phishing" else 0 for v in y_true])
    p = np.array([1 if v == "phishing" else 0 for v in y_pred])
    cm = confusion_matrix(t, p, labels=[0, 1]).tolist()
    roc: float | None = None
    if y_score is not None and len(set(t.tolist())) == 2:
        roc = float(roc_auc_score(t, np.asarray(y_score)))
    return MetricsReport(
        n=n,
        accuracy=round(float(accuracy_score(t, p)), 4),
        precision=round(float(precision_score(t, p, zero_division=0)), 4),
        recall=round(float(recall_score(t, p, zero_division=0)), 4),
        f1=round(float(f1_score(t, p, zero_division=0)), 4),
        roc_auc=None if roc is None else round(roc, 4),
        confusion_matrix=cm,
        labels_present=True,
    )
