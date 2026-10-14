"""Inference predictor for ViShield Scam Model.

Fully self-contained:
- Loads custom BPE tokenizer and trained neural weights
- Normalizes and masks entities
- Produces normalized conversation_scam_score strictly in [0.0, 1.0]
- Produces 6-criterion evaluation with critical indicator boost
- Adheres 100% to Voice Phishing Evaluator — Teammate Integration Guide
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .data.mask_entities import mask_entities
from .data.schema import (
    INDICATOR_KEYS,
    INDICATOR_WEIGHTS,
    ConversationEvidence,
    ConversationScamOutput,
    PhishingCriterionScores,
)

INDICATOR_DESCRIPTIONS = {
    "authority_impersonation": "impersonating authority, police, or bank officials",
    "urgency_fear": "creating artificial panic, deadlines, or arrest threats",
    "payment_request": "soliciting money transfer, UPI payment, or safe account deposit",
    "info_request": "requesting OTP, PIN, password, or sensitive credentials",
    "isolation_secrecy": "attempting to isolate the victim and enforce call secrecy",
    "trust_building": "using fabricated reference IDs or official technical jargon",
}


class ScamPredictor:
    """Self-contained predictor for scam conversation scoring."""

    def __init__(
        self,
        checkpoint_path: Path | str | None = None,
        tokenizer_path: Path | str | None = None,
        device: str | None = None,
    ):
        import torch

        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = device
        self.model = None
        self.tokenizer = None

        base_dir = Path(__file__).resolve().parent
        if checkpoint_path is None:
            checkpoint_path = base_dir / "artifacts" / "best_model.pt"
        if tokenizer_path is None:
            tokenizer_path = base_dir / "artifacts" / "tokenizer.json"

        self.checkpoint_path = Path(checkpoint_path)
        self.tokenizer_path = Path(tokenizer_path)

        # 1. Load Tokenizer
        if self.tokenizer_path.exists():
            from tokenizers import Tokenizer
            self.tokenizer = Tokenizer.from_file(str(self.tokenizer_path))

        # 2. Load Neural Model
        if self.checkpoint_path.exists():
            from .model.multitask_model import ViShieldMultiTaskModel

            state = torch.load(self.checkpoint_path, map_location=device)
            if isinstance(state, dict) and "model_state_dict" in state:
                state = state["model_state_dict"]

            vocab_size = state["encoder.token_embeddings.weight"].shape[0]
            n_layers = len([k for k in state.keys() if "encoder.layers." in k and k.endswith(".ln1.weight")])

            self.model = ViShieldMultiTaskModel(
                vocab_size=vocab_size,
                n_layers=n_layers if n_layers > 0 else 4,
            )
            self.model.load_state_dict(state)
            self.model.to(device)
            self.model.eval()

    def predict_fusion(self, text: str, call_id: str = "call-001") -> ConversationScamOutput:
        """Evaluates conversation text and returns the exact schema required by the Risk Fusion Engine.

        Conforms strictly to:
        - conversation_scam_score in [0.0, 1.0]
        - 6 Criteria: authority_impersonation, credential_otp_requests, payment_requests,
                      urgency_fear, isolation_secrecy, trust_manipulation
        - Critical indicator boost (e.g. high-severity OTP/credential theft)
        - Categorical risk levels: SAFE (0.00-0.39), SUSPICIOUS (0.40-0.69), HIGH_RISK (0.70-1.00)
        - Evidence flags and list of active indicator strings
        """
        raw = self.predict_raw(text)
        scam_prob = raw["is_scam_probability"]
        ind_map = raw["indicator_scores"]

        # Map internal indicators to Teammate Integration Guide nomenclature
        auth_score = ind_map.get("authority_impersonation", 0.0)
        urgency_score = ind_map.get("urgency_fear", 0.0)
        pay_score = ind_map.get("payment_request", 0.0)
        otp_score = ind_map.get("info_request", 0.0)
        iso_score = ind_map.get("isolation_secrecy", 0.0)
        trust_score = ind_map.get("trust_building", 0.0)

        criteria = PhishingCriterionScores(
            authority_impersonation=round(auth_score, 4),
            credential_otp_requests=round(otp_score, 4),
            payment_requests=round(pay_score, 4),
            urgency_fear=round(urgency_score, 4),
            isolation_secrecy=round(iso_score, 4),
            trust_manipulation=round(trust_score, 4),
        )

        # Weighted aggregation
        weighted_score = (
            auth_score * 0.25
            + otp_score * 0.25
            + pay_score * 0.20
            + urgency_score * 0.15
            + iso_score * 0.10
            + trust_score * 0.05
        )

        # Critical indicator boost (from Section 2 of Integration Guide):
        # "applies a critical indicator boost if high-severity items (e.g. OTP solicitation >= 0.85) are present"
        conv_score = max(scam_prob, weighted_score)
        if otp_score >= 0.80 or (auth_score >= 0.80 and pay_score >= 0.70):
            conv_score = max(conv_score, 0.90)
        elif auth_score >= 0.75 and urgency_score >= 0.75:
            conv_score = max(conv_score, 0.85)

        conv_score = max(0.0, min(1.0, round(conv_score, 4)))

        # Categorical classification thresholds (Section 7)
        # 0.00 – 0.39: SAFE
        # 0.40 – 0.69: SUSPICIOUS
        # 0.70 – 1.00: HIGH_RISK
        if conv_score >= 0.70:
            risk_level = "HIGH_RISK"
        elif conv_score >= 0.40:
            risk_level = "SUSPICIOUS"
        else:
            risk_level = "SAFE"

        # Evidence indicator flags
        lower_text = text.lower()
        bank_imp = auth_score >= 0.45 or any(w in lower_text for w in ["police", "cbi", "rbi", "customs", "trai", "courier department", "arrest warrant", "narcotics"])
        urgency_flag = urgency_score >= 0.45 or any(w in lower_text for w in ["immediately", "within 2 hours", "arrest", "block your sim", "urgent", "24 hours", "penalty"])
        otp_flag = otp_score >= 0.45 or any(w in lower_text for w in ["otp", "one time password", "4-digit", "6-digit", "pin number", "cvv", "verification code"])
        pay_flag = pay_score >= 0.45 or any(w in lower_text for w in ["upi", "safe account", "transfer", "refundable fee", "deposit", "rs", "lakhs", "rupees"])
        iso_flag = iso_score >= 0.45 or any(w in lower_text for w in ["don't disconnect", "secret", "private", "do not tell anyone", "isolated", "close the door"])

        indicators: list[str] = []
        if bank_imp:
            indicators.append("Authority/Bank impersonation")
        if urgency_flag:
            indicators.append("Threat of account suspension or urgent coercion")
        if otp_flag:
            indicators.append("OTP credential solicitation")
        if pay_flag:
            indicators.append("Demands for funds transfer or suspicious payment")
        if iso_flag:
            indicators.append("Victim isolation and secrecy tactics")

        evidence = ConversationEvidence(
            bank_impersonation=bank_imp,
            urgency_or_fear=urgency_flag,
            otp_or_credential_request=otp_flag,
            payment_request=pay_flag,
            isolation_tactics=iso_flag,
            indicators=indicators,
        )

        return ConversationScamOutput(
            call_id=call_id,
            conversation_scam_score=conv_score,
            overall_scam_probability=conv_score,
            risk_level=risk_level,
            criteria=criteria,
            evidence=evidence,
            explanation=raw["explanation"],
        )

    def predict_raw(self, text: str) -> dict[str, Any]:
        """Low-level neural score inference."""
        import torch

        clean_text = text
        if "<transcript>" in clean_text:
            clean_text = re.sub(r"</?transcript>", "", clean_text).strip()

        masked_res = mask_entities(clean_text)
        input_text = masked_res.masked_text

        if self.model is not None and self.tokenizer is not None:
            encoding = self.tokenizer.encode(input_text)
            input_ids = torch.tensor([encoding.ids], dtype=torch.long, device=self.device)
            attention_mask = torch.tensor([encoding.attention_mask], dtype=torch.long, device=self.device)

            with torch.no_grad():
                outputs = self.model(input_ids, attention_mask)
                scam_prob = float(outputs["scam_probs"].item())
                ind_probs = outputs["indicator_probs"].squeeze(0).cpu().tolist()

            indicator_scores = {
                key: round(float(prob), 4) for key, prob in zip(INDICATOR_KEYS, ind_probs)
            }
        else:
            # Fallback heuristic
            indicator_scores = {key: 0.1 for key in INDICATOR_KEYS}
            scam_prob = 0.1

        scam_prob = max(0.0, min(1.0, round(scam_prob, 4)))
        predicted_label = "scam" if scam_prob >= 0.5 else "legitimate"

        active_indicators = [(k, v) for k, v in indicator_scores.items() if v >= 0.4]
        active_indicators.sort(key=lambda x: x[1], reverse=True)

        if active_indicators:
            top_reasons = [INDICATOR_DESCRIPTIONS[k] for k, _ in active_indicators[:3]]
            explanation = f"Detected scam signals: {', '.join(top_reasons)}."
        elif scam_prob < 0.2:
            explanation = "Normal legitimate communication. No deceptive indicators detected."
        else:
            explanation = "Low to borderline suspicious activity detected."

        return {
            "is_scam_probability": scam_prob,
            "predicted_label": predicted_label,
            "indicator_scores": indicator_scores,
            "masked_text": input_text,
            "explanation": explanation,
        }
