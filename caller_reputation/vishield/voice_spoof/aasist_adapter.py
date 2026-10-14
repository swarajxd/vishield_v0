"""
aasist_adapter.py
-----------------
Converts raw SSL-AASIST model output into a normalized voice_spoof_score
in [0.0, 1.0] as required by the Risk Fusion Engine contract.

Score convention (from the integration guide):
    0.0 = Bona-fide natural human speech  (no spoof detected)
    1.0 = Synthetic / cloned / voice-converted speech  (spoof detected)

Our model output format
-----------------------
test_best.py computes:
    batch_scores = (out[:, 1] - out[:, 0])   # bonafide_logit - spoof_logit

So the raw value `z` is a BONAFIDE-favoring logit difference:
    z >> 0  →  model is confident = bonafide
    z << 0  →  model is confident = spoof

To turn this into a SPOOF-risk score we negate before applying sigmoid:
    voice_spoof_score = σ(-z) = 1 / (1 + exp(z))

This is mathematically equivalent to  p_spoof  from a two-class softmax.

Supported input modes (RawAASISTOutput)
---------------------------------------
1. bonafide_minus_spoof_logit  – what test_best.py produces  (DEFAULT)
2. spoof_probability           – direct p_spoof from softmax
3. bonafide_probability        – p_bonafide; inverted automatically
4. spoof_logit                 – raw spoof-favoring logit; sigmoid applied
5. binary_label                – BONAFIDE → 0.05, SPOOF → 0.95
"""

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Enums & data classes
# ---------------------------------------------------------------------------

class AASISTOutputMode(str, Enum):
    BONAFIDE_MINUS_SPOOF_LOGIT = "bonafide_minus_spoof_logit"  # our model default
    SPOOF_PROBABILITY          = "spoof_probability"
    BONAFIDE_PROBABILITY       = "bonafide_probability"
    SPOOF_LOGIT                = "spoof_logit"
    BINARY_LABEL               = "binary_label"          # "BONAFIDE" or "SPOOF"


@dataclass
class RawAASISTOutput:
    """
    Carry the raw value from your inference pipeline.

    Parameters
    ----------
    call_id : str
        Unique identifier for the call / audio chunk.
    value : float | str
        The raw score or label from the model. For binary mode pass
        the string "BONAFIDE" or "SPOOF".
    mode : AASISTOutputMode
        Declares how `value` should be interpreted.
        Default = BONAFIDE_MINUS_SPOOF_LOGIT  (matches test_best.py output).
    utterance_id : str, optional
        ASVspoof utterance ID (e.g. "LA_E_2834763") for traceability.
    """
    call_id: str
    value: float | str
    mode: AASISTOutputMode = AASISTOutputMode.BONAFIDE_MINUS_SPOOF_LOGIT
    utterance_id: Optional[str] = None


@dataclass
class VoiceSpoofSignal:
    """
    Normalized output delivered to the Risk Fusion Engine.

    Fields match the fusion engine JSON contract exactly.
    """
    call_id: str
    voice_spoof_score: float          # ∈ [0.0, 1.0]
    utterance_id: Optional[str] = None
    raw_value: Optional[float] = None # original value before conversion
    mode_used: str = ""

    def to_dict(self) -> dict:
        return {
            "call_id": self.call_id,
            "voice_spoof_score": round(self.voice_spoof_score, 6),
        }


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _sigmoid(x: float) -> float:
    """Numerically stable sigmoid."""
    if x >= 0:
        return 1.0 / (1.0 + math.exp(-x))
    else:
        ex = math.exp(x)
        return ex / (1.0 + ex)


def _clamp(x: float) -> float:
    """Hard-clamp to [0.0, 1.0] as a safety net."""
    return max(0.0, min(1.0, x))


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class AASISTAdapter:
    """
    Converts raw SSL-AASIST model output to a normalized voice_spoof_score.

    Usage (default – matches test_best.py pipeline):
    ------------------------------------------------
    >>> adapter = AASISTAdapter()
    >>> signal = adapter.normalize(RawAASISTOutput(
    ...     call_id="call-100",
    ...     value=3.556298,   # (out[:,1] - out[:,0]) from the model
    ... ))
    >>> print(signal.voice_spoof_score)   # e.g. 0.0277  → low spoof risk
    >>> print(signal.to_dict())
    {'call_id': 'call-100', 'voice_spoof_score': 0.027692}

    Usage (direct spoof probability from softmax):
    ------------------------------------------------
    >>> signal = adapter.normalize(RawAASISTOutput(
    ...     call_id="call-100",
    ...     value=0.92,
    ...     mode=AASISTOutputMode.SPOOF_PROBABILITY,
    ... ))
    >>> print(signal.voice_spoof_score)   # 0.92
    """

    # Binary label mappings per the integration guide
    _BINARY_MAP = {
        "BONAFIDE": 0.05,
        "SPOOF":    0.95,
    }

    def normalize(self, raw: RawAASISTOutput) -> VoiceSpoofSignal:
        """
        Normalize a single RawAASISTOutput → VoiceSpoofSignal.

        Raises
        ------
        ValueError  if the value is out of expected range or unknown label.
        """
        mode = raw.mode
        val  = raw.value

        if mode == AASISTOutputMode.BONAFIDE_MINUS_SPOOF_LOGIT:
            # z = bonafide_logit - spoof_logit
            # spoof score = σ(-z) = p_spoof from two-class softmax
            z = float(val)
            score = _sigmoid(-z)

        elif mode == AASISTOutputMode.SPOOF_PROBABILITY:
            score = float(val)
            if not (0.0 <= score <= 1.0):
                raise ValueError(
                    f"spoof_probability must be in [0,1], got {score}"
                )

        elif mode == AASISTOutputMode.BONAFIDE_PROBABILITY:
            p_bona = float(val)
            if not (0.0 <= p_bona <= 1.0):
                raise ValueError(
                    f"bonafide_probability must be in [0,1], got {p_bona}"
                )
            score = 1.0 - p_bona

        elif mode == AASISTOutputMode.SPOOF_LOGIT:
            # z is spoof-favoring; high z → spoof
            score = _sigmoid(float(val))

        elif mode == AASISTOutputMode.BINARY_LABEL:
            label = str(val).strip().upper()
            if label not in self._BINARY_MAP:
                raise ValueError(
                    f"Unknown binary label '{val}'. Expected BONAFIDE or SPOOF."
                )
            score = self._BINARY_MAP[label]

        else:
            raise ValueError(f"Unknown AASISTOutputMode: {mode}")

        score = _clamp(score)

        return VoiceSpoofSignal(
            call_id=raw.call_id,
            voice_spoof_score=score,
            utterance_id=raw.utterance_id,
            raw_value=float(val) if mode != AASISTOutputMode.BINARY_LABEL else None,
            mode_used=mode.value,
        )

    def normalize_batch(
        self, raws: list[RawAASISTOutput]
    ) -> list[VoiceSpoofSignal]:
        """Normalize a list of raw outputs in one call."""
        return [self.normalize(r) for r in raws]
