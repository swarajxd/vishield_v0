"""EXPERIMENTAL synthetic-voice signal behind a replaceable interface. Disabled by default.

The shipped implementation is a transparent heuristic on spectral flatness and pitch variance.
It is *not* a deepfake detector and must never be presented as proof that audio is
AI-generated. A trained model (e.g. an anti-spoofing CNN) can implement the same Protocol.
"""

from __future__ import annotations

from typing import Protocol

from vishield.domain.models import AcousticSummary

SYNTHETIC_VOICE_DISCLAIMER = (
    "Synthetic-voice score is experimental and may be inaccurate. It is a heuristic on "
    "aggregate spectral statistics and does not prove the audio is AI-generated."
)


class SyntheticVoiceDetector(Protocol):
    name: str

    def score(self, summary: AcousticSummary) -> float:
        """Return a value in [0, 1] where higher means more synthetic-like."""


class HeuristicSyntheticVoiceDetector:
    """Very low pitch variance and unusually flat spectra nudge the score upward."""

    name = "heuristic-flatness-pitch-v0"

    def score(self, summary: AcousticSummary) -> float:
        if summary.duration_seconds < 1.0 or summary.speech_ratio == 0.0:
            return 0.0
        flat_component = min(1.0, summary.spectral_flatness_mean / 0.3)
        pitch_component = 0.0
        if summary.pitch_std_hz is not None:
            pitch_component = 1.0 - min(1.0, summary.pitch_std_hz / 25.0)
        return round(float(0.5 * flat_component + 0.5 * pitch_component), 4)


class DisabledSyntheticVoiceDetector:
    name = "disabled"

    def score(self, summary: AcousticSummary) -> float:
        return 0.0
