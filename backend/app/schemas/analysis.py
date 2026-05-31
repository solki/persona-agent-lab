"""Pydantic schemas for the Experiment Insight Analyzer.

The analyzer is an internal platform service — not a user agent.
It reads experiment/run/collaboration data and produces structured
analysis. It cannot modify agents, souls, workflows, memories, or
proposed memories.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------


class ExperimentAnalysisRequest(BaseModel):
    provider: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


# ---------------------------------------------------------------------------
# Analysis result sub-models
# ---------------------------------------------------------------------------


class FlowComparison(BaseModel):
    model_config = {"extra": "ignore"}

    variant_soul_name: str
    variant_soul_id: int
    delegation_pattern: str
    worker_coverage: str
    decision_style_observed: str
    instruction_style: str
    synthesis_approach: str


class BehavioralDifference(BaseModel):
    model_config = {"extra": "ignore"}

    dimension: str
    observation: str
    variant_a_behavior: str
    variant_b_behavior: str
    significance: str  # "clear_signal" | "suggestive" | "inconclusive"
    confidence_rationale: str

    @field_validator("significance", mode="before")
    @classmethod
    def _normalize_significance(cls, v: Any) -> str:
        if not isinstance(v, str):
            return "inconclusive"
        lower = v.strip().lower()
        if lower in ("clear_signal", "clear signal"):
            return "clear_signal"
        if lower == "suggestive":
            return "suggestive"
        return "inconclusive"


class ExpectedVsActual(BaseModel):
    model_config = {"extra": "ignore"}

    expected: str
    matched: list[str] = Field(default_factory=list)
    unmatched: list[str] = Field(default_factory=list)
    surprising: list[str] = Field(default_factory=list)


class Signals(BaseModel):
    model_config = {"extra": "ignore"}

    efficiency: dict[str, Any]
    thoroughness: dict[str, Any]
    safety: dict[str, Any]
    overall_pattern: str
    caveat: str


class AnalysisResult(BaseModel):
    model_config = {"extra": "ignore"}

    executive_summary: str
    flow_comparison: list[FlowComparison]
    behavioral_differences: list[BehavioralDifference]
    expected_vs_actual: Optional[ExpectedVsActual] = None
    signals: Signals
    limitations: list[str] = Field(default_factory=list)
    recommended_next_steps: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------


class ExperimentAnalysisResponse(BaseModel):
    experiment_id: int
    analyzed_at: datetime
    provider: str
    model: str
    key_from_env: bool = False
    analysis: AnalysisResult
