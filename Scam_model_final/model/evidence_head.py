"""Token-level evidence extraction head."""

from __future__ import annotations

import torch
import torch.nn as nn


class EvidenceHead(nn.Module):
    """Token-level tagging head predicting indicator presence for each token."""

    def __init__(self, d_model: int = 256, num_indicators: int = 6, hidden_dim: int = 64, dropout: float = 0.1):
        super().__init__()
        self.num_indicators = num_indicators
        self.net = nn.Sequential(
            nn.Linear(d_model, hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, num_indicators),
        )

    def forward(self, token_states: torch.Tensor) -> torch.Tensor:
        """Args:
            token_states: [batch_size, seq_len, d_model]
        Returns:
            logits: [batch_size, seq_len, num_indicators]
        """
        return self.net(token_states)
