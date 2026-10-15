"""Base abstract adapter contracts for signal normalization."""

from abc import ABC, abstractmethod
from typing import Generic, Optional, TypeVar
from pydantic import BaseModel, Field

from app.schemas.risk import RiskEvidence

RawInputT = TypeVar("RawInputT")


class NormalizedSignal(BaseModel):
    """Standardized representation of a single normalized signal."""

    score: float = Field(..., ge=0.0, le=1.0, description="Normalized risk score in [0.0, 1.0]")
    source: str = Field(..., description="Adapter and model source identifier")
    evidence: Optional[RiskEvidence] = Field(default=None, description="Extracted upstream evidence")


class BaseSignalAdapter(ABC, Generic[RawInputT]):
    """Abstract interface for external component output normalization.

    External teams implement or configure an adapter instance that converts
    their component's raw output (logits, labels, criterion scores, trust scores)
    into a standardized NormalizedSignal with a score strictly bounded in [0.0, 1.0].
    """

    @abstractmethod
    def normalize(self, raw_input: RawInputT) -> NormalizedSignal:
        """Convert raw component output into a normalized score and evidence."""
        pass
