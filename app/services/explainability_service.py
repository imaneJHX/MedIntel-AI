"""One training-only background per process; individual SHAP only on request."""

from fastapi import Request
import numpy as np

from app.core.exceptions import ServiceError
from app.schemas.explanation import Explanation, ExplanationResponse, FeatureContribution
from app.schemas.patient import HeartRecord
from .model_service import ModelService
from src.explainability import UNITS, build_explainer, explain_global, transform_records, validate_reconstruction


class ExplainabilityService:
    """Reuse the frozen Phase 4 engine and the model service's shared inference lock."""

    def __init__(self, model: ModelService):
        self.model = model
        self.engine = build_explainer(model.pipeline, model.training_reference)

    def explain(self, record: HeartRecord) -> ExplanationResponse:
        with self.model.lock:
            frame = self.model.to_frame(record)
            prediction = self.model._predict_frame(frame)
            # Although named explain_global, this source function processes exactly one row here.
            values = explain_global(self.engine, frame)
            diagnostics = validate_reconstruction(self.engine, frame, values)
            transformed = transform_records(self.model.pipeline, frame).to_numpy()[0]
            contributions = [FeatureContribution(
                feature=row["transformed_feature"], original_feature=row["original_feature"],
                category=None if row["representation"] == "standardized_measurement" else float(row["category"]),
                transformed_value=float(transformed[index]), contribution_log_odds=float(values.values[0, index]),
            ) for index, row in self.engine.mapping.iterrows()]
            positive = sorted((item for item in contributions if item.contribution_log_odds > 0), key=lambda item: -item.contribution_log_odds)[:3]
            negative = sorted((item for item in contributions if item.contribution_log_odds < 0), key=lambda item: item.contribution_log_odds)[:3]
            baseline = float(np.asarray(values.base_values)[0])
            total = baseline + float(values.values[0].sum())
            log_odds = float(self.model.pipeline.named_steps["classifier"].decision_function(
                transform_records(self.model.pipeline, frame).to_numpy())[0])
            return ExplanationResponse(prediction=prediction, explanation=Explanation(
                units=UNITS, baseline_log_odds=baseline, model_output_log_odds=log_odds,
                reconstructed_log_odds=total, max_reconstruction_error=diagnostics["max_log_odds_error"],
                background_records=self.engine.background_records, input_values=record.model_dump(),
                feature_contributions=contributions, top_positive_contributors=positive, top_negative_contributors=negative,
                interpretation="Positive contributions increase class-1 log-odds relative to the training background; negative contributions decrease them. These are model associations, not probability changes or disease causes.",
            ))


def get_explanation_service(request: Request) -> ExplainabilityService:
    service = getattr(request.app.state, "explanation_service", None)
    if service is None:
        raise ServiceError(503, "explanation_unavailable", "The explanation service is unavailable.")
    return service
