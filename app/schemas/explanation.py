"""One-record additive explanation output in positive-class log-odds."""

from typing import Literal
from pydantic import BaseModel, ConfigDict
from .prediction import PredictionResponse


class FeatureContribution(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    feature: str
    original_feature: str
    category: float | None
    transformed_value: float
    contribution_log_odds: float


class Explanation(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    units: Literal["positive-class log-odds"]
    baseline_log_odds: float
    model_output_log_odds: float
    reconstructed_log_odds: float
    max_reconstruction_error: float
    background_records: int
    input_values: dict[str, float | int | None]
    feature_contributions: list[FeatureContribution]
    top_positive_contributors: list[FeatureContribution]
    top_negative_contributors: list[FeatureContribution]
    interpretation: str


class ExplanationResponse(PredictionResponse):
    explanation: Explanation
