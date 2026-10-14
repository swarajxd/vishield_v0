"""Non-identifying acoustic statistics and an experimental acoustic-pressure heuristic.

Nothing here can identify a speaker: we keep only aggregate statistics (means, standard
deviations, counts). No embeddings, no MFCC frames, no raw audio leave this function.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

from vishield.domain.models import AcousticSummary

_FRAME = 1024
_HOP = 256
_PAUSE_MIN_SECONDS = 0.3


def extract_features(samples: NDArray[np.float32], sample_rate: int) -> AcousticSummary:
    """Compute duration, pauses, speaking-rate proxy, pitch and spectral statistics."""
    import librosa

    duration = float(len(samples)) / sample_rate
    if len(samples) < _FRAME:
        return AcousticSummary(
            duration_seconds=duration,
            sample_rate=sample_rate,
            speech_ratio=0.0,
            pause_count=0,
            mean_pause_seconds=0.0,
            speaking_rate_proxy=0.0,
            pitch_mean_hz=None,
            pitch_std_hz=None,
            spectral_centroid_mean=0.0,
            spectral_flatness_mean=0.0,
            rms_mean=0.0,
        )

    rms = librosa.feature.rms(y=samples, frame_length=_FRAME, hop_length=_HOP)[0]
    threshold = max(1e-4, 0.15 * float(np.max(rms)))
    voiced = rms > threshold
    speech_ratio = float(np.mean(voiced)) if voiced.size else 0.0

    pause_frames_min = int(_PAUSE_MIN_SECONDS * sample_rate / _HOP)
    pauses = _runs(~voiced, pause_frames_min)
    pause_count = len(pauses)
    mean_pause = float(np.mean(pauses) * _HOP / sample_rate) if pauses else 0.0

    onsets = librosa.onset.onset_detect(y=samples, sr=sample_rate, hop_length=_HOP, units="frames")
    speaking_rate = float(len(onsets)) / duration if duration > 0 else 0.0

    pitch_mean: float | None = None
    pitch_std: float | None = None
    try:
        f0 = librosa.yin(samples, fmin=65.0, fmax=400.0, sr=sample_rate, frame_length=2048)
        f0_voiced = f0[voiced[: len(f0)]] if len(voiced) >= len(f0) else f0
        f0_voiced = f0_voiced[(f0_voiced > 65.0) & (f0_voiced < 400.0)]
        if f0_voiced.size >= 5:
            pitch_mean = float(np.mean(f0_voiced))
            pitch_std = float(np.std(f0_voiced))
    except (ValueError, IndexError):
        pitch_mean = pitch_std = None

    centroid = librosa.feature.spectral_centroid(y=samples, sr=sample_rate, hop_length=_HOP)[0]
    flatness = librosa.feature.spectral_flatness(y=samples, hop_length=_HOP)[0]

    return AcousticSummary(
        duration_seconds=round(duration, 3),
        sample_rate=sample_rate,
        speech_ratio=round(speech_ratio, 4),
        pause_count=pause_count,
        mean_pause_seconds=round(mean_pause, 3),
        speaking_rate_proxy=round(speaking_rate, 3),
        pitch_mean_hz=None if pitch_mean is None else round(pitch_mean, 1),
        pitch_std_hz=None if pitch_std is None else round(pitch_std, 1),
        spectral_centroid_mean=round(float(np.mean(centroid)), 1),
        spectral_flatness_mean=round(float(np.mean(flatness)), 5),
        rms_mean=round(float(np.mean(rms)), 5),
    )


def _runs(mask: NDArray[np.bool_], min_len: int) -> list[int]:
    """Lengths of consecutive True runs at least ``min_len`` long."""
    runs: list[int] = []
    count = 0
    for value in mask:
        if value:
            count += 1
        else:
            if count >= min_len:
                runs.append(count)
            count = 0
    if count >= min_len:
        runs.append(count)
    return runs


def acoustic_pressure_score(summary: AcousticSummary) -> float:
    """EXPERIMENTAL heuristic in [0, 1]: fast, pause-less, monotone delivery scores higher.

    This is a hand-written proxy for "pressured" speech, not a trained detector. It carries a
    small default weight and is reported separately so reviewers can discount it.
    """
    if summary.duration_seconds < 1.0:
        return 0.0
    rate_component = min(1.0, max(0.0, (summary.speaking_rate_proxy - 2.5) / 3.0))
    pause_component = 1.0 - min(1.0, summary.pause_count / max(1.0, summary.duration_seconds / 4))
    monotone_component = 0.0
    if summary.pitch_std_hz is not None:
        monotone_component = 1.0 - min(1.0, summary.pitch_std_hz / 40.0)
    score = 0.4 * rate_component + 0.4 * pause_component + 0.2 * monotone_component
    return round(float(max(0.0, min(1.0, score))), 4)
