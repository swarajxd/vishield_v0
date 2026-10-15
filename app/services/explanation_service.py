"""Explanation service for the Risk Fusion Engine.

Generates concise, human-readable explanations synthesizing weighted risk contributions
and preserved upstream evidence without fabricating independent detections.
"""

from typing import List, Optional

from app.schemas.risk import (
    ComponentScores,
    RiskEvidence,
    RiskLevel,
    WeightedContributions,
)


class ExplanationService:
    """Produces explainable rationales for risk evaluations."""

    @staticmethod
    def _qualify_score(score: float) -> str:
        """Categorize a score into a qualitative intensity descriptor."""
        if score >= 0.70:
            return "high"
        if score >= 0.40:
            return "moderate"
        return "low"

    @classmethod
    def generate_explanation(
        cls,
        risk_level: RiskLevel,
        final_risk_score: float,
        components: ComponentScores,
        contributions: WeightedContributions,
        evidence: Optional[RiskEvidence] = None,
    ) -> str:
        """Construct a transparent summary of why the call reached its risk level.

        Args:
            risk_level: SAFE, SUSPICIOUS, or HIGH_RISK.
            final_risk_score: Calculated fused score.
            components: Raw normalized input scores.
            contributions: Weighted contributions.
            evidence: Optional upstream evidence.

        Returns:
            A concise, context-aware explanation string.
        """
        conv_q = cls._qualify_score(components.conversation_scam_score)
        voice_q = cls._qualify_score(components.voice_spoof_score)
        rep_q = cls._qualify_score(components.caller_reputation_score)

        clauses: List[str] = []

        if risk_level == RiskLevel.HIGH_RISK:
            drivers = []
            if conv_q == "high":
                drivers.append("high conversation scam indicators")
            elif conv_q == "moderate":
                drivers.append("moderate conversation risk")

            if voice_q == "high":
                drivers.append("a high voice spoof score")
            elif voice_q == "moderate":
                drivers.append("elevated voice spoof risk")

            if rep_q == "high":
                drivers.append("suspicious caller reputation")
            elif rep_q == "moderate":
                drivers.append("questionable caller reputation")

            if not drivers:
                drivers.append("cumulative moderate risk factors across all signals")

            clauses.append(f"{', '.join(drivers).capitalize()} contributed to the high overall risk.")

        elif risk_level == RiskLevel.SUSPICIOUS:
            reasons = []
            if conv_q in ("high", "moderate"):
                reasons.append(f"{conv_q} conversation scam indicators")
            if voice_q in ("high", "moderate"):
                reasons.append(f"{voice_q} voice spoof likelihood")
            if rep_q in ("high", "moderate"):
                reasons.append(f"{rep_q} caller reputation risk")

            if reasons:
                clauses.append(
                    f"Call classified as SUSPICIOUS due to {', '.join(reasons)} warranting further caution."
                )
            else:
                clauses.append(
                    "Call classified as SUSPICIOUS due to borderline combined risk indicators."
                )

        else:  # SAFE
            clauses.append(
                f"Low risk detected across conversation analysis ({components.conversation_scam_score:.2f}), "
                f"voice authenticity ({components.voice_spoof_score:.2f}), and "
                f"caller reputation ({components.caller_reputation_score:.2f})."
            )

        # Append upstream evidence summary if provided
        if evidence:
            evidence_items: List[str] = []
            if evidence.bank_impersonation:
                evidence_items.append("authority/bank impersonation")
            if evidence.otp_or_credential_request:
                evidence_items.append("credential/OTP request")
            if evidence.urgency_or_fear:
                evidence_items.append("urgency tactics")
            if evidence.payment_request:
                evidence_items.append("unsolicited payment request")
            if evidence.isolation_tactics:
                evidence_items.append("call secrecy demands")
            if evidence.synthetic_voice_detected:
                evidence_items.append("synthetic voice artifacts")
            if evidence.reported_scam_category:
                evidence_items.append(f"reputation flag: {evidence.reported_scam_category}")

            # Also incorporate any custom indicators
            for ind in evidence.indicators:
                if ind.lower() not in [item.lower() for item in evidence_items]:
                    evidence_items.append(ind)

            if evidence_items:
                clauses.append(f"Upstream evidence noted: {', '.join(evidence_items)}.")

        return " ".join(clauses)
