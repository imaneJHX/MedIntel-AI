"""Public health, model metadata, and form-schema response types."""

from typing import Literal
from pydantic import BaseModel
from .prediction import DISCLAIMER


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["MedIntel AI"] = "MedIntel AI"
    version: Literal["1.0.0"] = "1.0.0"


class ReadyResponse(BaseModel):
    status: Literal["ready"] = "ready"
    model_loaded: bool = True
    explainer_initialized: bool = True


class ModelMetadata(BaseModel):
    model: str
    algorithm: str
    dataset: str
    dataset_url: str
    input_features: list[str]
    transformed_feature_count: int
    class_labels: dict[str, str]
    artifact_sha256: str
    threshold: float
    research_only: bool
    evaluation_records: int
    experimental_holdout_metrics: dict[str, float]
    limitations: list[str]
    disclaimer: str = DISCLAIMER


class CategoryOption(BaseModel):
    value: int
    label: str


class InputField(BaseModel):
    name: str
    label: str
    type: Literal["number", "integer"]
    unit: str | None
    description: str
    required: bool
    nullable: bool
    minimum: float | None
    maximum: float | None
    options: list[CategoryOption]


class InputSchemaResponse(BaseModel):
    model: str
    fields: list[InputField]
    numeric_range_semantics: str
    missing_value_policy: str
