"""Multitask ViShield Model combining Transformer encoder, Model A, Model B, and Evidence Head."""

from __future__ import annotations

import torch
import torch.nn as nn
from .evidence_head import EvidenceHead
from .transformer import ViShieldTransformerEncoder

INDICATOR_KEYS: list[str] = [
    "authority_impersonation",
    "urgency_fear",
    "payment_request",
    "info_request",
    "isolation_secrecy",
    "trust_building",
]


class ViShieldMultiTaskModel(nn.Module):
    """End-to-end task-specific model:
    - Model A: Binary scam-versus-legitimate probability.
    - Model B: 6 independent scam-indicator probabilities.
    - Evidence Head: Token-level per-indicator tags.
    """

    def __init__(
        self,
        vocab_size: int = 8000,
        max_seq_length: int = 256,
        d_model: int = 256,
        n_layers: int = 4,
        n_heads: int = 4,
        d_ff: int = 1024,
        dropout: float = 0.1,
        num_indicators: int = 6,
    ):
        super().__init__()
        self.num_indicators = num_indicators
        self.encoder = ViShieldTransformerEncoder(
            vocab_size=vocab_size,
            max_seq_length=max_seq_length,
            d_model=d_model,
            n_layers=n_layers,
            n_heads=n_heads,
            d_ff=d_ff,
            dropout=dropout,
        )

        # Model B: 6 Indicator Multi-label Head
        self.model_b_head = nn.Sequential(
            nn.Linear(d_model, 128),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(128, num_indicators),
        )

        # Model A: Binary Scam Head (conditions on pooled representation + Model B logits for consistency)
        self.model_a_head = nn.Sequential(
            nn.Linear(d_model + num_indicators, 64),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(64, 1),
        )

        # Evidence Head: token-level tags
        self.evidence_head = EvidenceHead(
            d_model=d_model,
            num_indicators=num_indicators,
            hidden_dim=64,
            dropout=dropout,
        )

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor | None = None,
    ) -> dict[str, torch.Tensor]:
        token_states, pooled_seq = self.encoder(input_ids, attention_mask)

        # 1. Model B indicator logits
        indicator_logits = self.model_b_head(pooled_seq)
        indicator_probs = torch.sigmoid(indicator_logits)

        # 2. Model A scam verdict
        a_input = torch.cat([pooled_seq, indicator_logits], dim=-1)
        scam_logits = self.model_a_head(a_input)
        scam_probs = torch.sigmoid(scam_logits)

        # 3. Evidence token logits
        evidence_logits = self.evidence_head(token_states)

        return {
            "token_states": token_states,
            "pooled_seq": pooled_seq,
            "scam_logits": scam_logits,
            "scam_probs": scam_probs,
            "indicator_logits": indicator_logits,
            "indicator_probs": indicator_probs,
            "evidence_logits": evidence_logits,
        }
