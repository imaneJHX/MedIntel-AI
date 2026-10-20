"""Prediction output labels explicitly distinguish scores from clinical risk."""

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

MODEL_ID = "heart-disease-logistic-regression"
DISCLAIMER = "Experimental research output. Not a medical diagnosis or clinically calibrated risk estimate."
CLASS_LABELS = {0: "Recorded heart disease absent", 1: "Recorded heart disease present"}


class Prediction(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    class_id: Literal[0, 1]
    class_label: str
    positive_class_score: float = Field(ge=0, le=1, description="Uncalibrated model output for class 1; not a real-world disease probability.")
    threshold: float = Field(gt=0, lt=1)
    score_semantics: Literal["uncalibrated_experimental_model_score"] = "uncalibrated_experimental_model_score"


class PredictionResponse(BaseModel):
    model: Literal["heart-disease-logistic-regression"] = MODEL_ID
    prediction: Prediction
    disclaimer: str = DISCLAIMER
