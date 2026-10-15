"""Utility builder for assembling adapter signals into RiskEvaluationRequest."""

from typing import List, Optional

from app.adapters.base import NormalizedSignal
from app.schemas.risk import CallMetadata, RiskEvidence, RiskEvaluationRequest


def build_evaluation_request(
    call_id: str,
    conversation_signal: NormalizedSignal,
    voice_signal: NormalizedSignal,
    reputation_signal: NormalizedSignal,
    metadata: Optional[CallMetadata] = None,
    source: Optional[str] = "adapter_pipeline",
) -> RiskEvaluationRequest:
    """Combine signals from the three independent adapters into a single evaluation request.

    Merges structured evidence and indicator lists from all three components.
    """
    merged_indicators: List[str] = []
    seen = set()

    for sig in (conversation_signal, voice_signal, reputation_signal):
        if sig.evidence and sig.evidence.indicators:
            for ind in sig.evidence.indicators:
                if ind not in seen:
                    seen.add(ind)
                    merged_indicators.append(ind)

    conv_ev = conversation_signal.evidence
    voice_ev = voice_signal.evidence
    rep_ev = reputation_signal.evidence

    combined_evidence = RiskEvidence(
        bank_impersonation=conv_ev.bank_impersonation if conv_ev else None,
        urgency_or_fear=conv_ev.urgency_or_fear if conv_ev else None,
        otp_or_credential_request=conv_ev.otp_or_credential_request if conv_ev else None,
        payment_request=conv_ev.payment_request if conv_ev else None,
        isolation_tactics=conv_ev.isolation_tactics if conv_ev else None,
        synthetic_voice_detected=voice_ev.synthetic_voice_detected if voice_ev else None,
        spoof_confidence=voice_ev.spoof_confidence if voice_ev else None,
        reported_scam_category=rep_ev.reported_scam_category if rep_ev else None,
        complaints_count=rep_ev.complaints_count if rep_ev else None,
        indicators=merged_indicators,
    )

    return RiskEvaluationRequest(
        call_id=call_id,
        conversation_scam_score=conversation_signal.score,
        voice_spoof_score=voice_signal.score,
        caller_reputation_score=reputation_signal.score,
        source=source,
        metadata=metadata,
        evidence=combined_evidence,
    )
