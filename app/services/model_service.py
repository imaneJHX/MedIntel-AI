"""Load one trusted fitted pipeline and keep all serving operations in memory."""

from dataclasses import dataclass, field
from hashlib import sha256
import importlib.metadata
import json
from pathlib import Path
import platform
from threading import RLock
from typing import Any

from fastapi import Request
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

from app.core.config import Settings
from app.core.exceptions import ServiceError
from app.schemas.patient import FIELD_DEFINITIONS, HeartRecord
from app.schemas.prediction import CLASS_LABELS, MODEL_ID, Prediction
from src.data_loader import FEATURES, load_heart_data, split_data
from src.explainability import extract_components, feature_mapping
from src.model_utils import load_pipeline, validate_inputs
from src.preprocessing import CATEGORICAL_FEATURES


@dataclass
class ModelService:
    """The reference is training-only; locks serialize use of the shared frozen state."""

    pipeline: Pipeline
    training_reference: pd.DataFrame
    report: dict[str, Any]
    artifact_sha256: str
    threshold: float
    positive_class_index: int
    lock: RLock = field(default_factory=RLock)
    initialized: bool = True

    @classmethod
    def load(cls, settings: Settings) -> "ModelService":
        """Verify local provenance/schema and smoke-test once; never fit or download."""
        root = settings.project_root
        report = json.loads((root / "reports/metrics/experiment.json").read_text(encoding="utf-8"))
        relative = "models/heart_disease_pipeline.joblib"
        artifact_hash = report["generated_file_hashes"][relative]
        if report["selected_model"] != "Logistic Regression" or report["raw_features"] != FEATURES:
            raise ValueError("Unexpected frozen model metadata.")
        if report["versions"]["python"] != platform.python_version():
            raise ValueError("The model's tested Python version differs.")
        for package in ["scikit-learn", "numpy", "pandas", "joblib", "scipy"]:
            if importlib.metadata.version(package) != report["versions"][package]:
                raise ValueError("The model's tested library versions differ.")
        pipeline = load_pipeline(root / relative, trusted=True, expected_sha256=artifact_hash)
        preprocessor, _ = extract_components(pipeline)
        if len(feature_mapping(pipeline)) != 28:
            raise ValueError("Unexpected transformed feature schema.")
        threshold = float(report["threshold"])
        if not np.isfinite(threshold) or not 0 < threshold < 1:
            raise ValueError("Invalid saved decision threshold.")
        X, y = load_heart_data(root / "data/raw/processed.cleveland.data")
        train, _, _, _ = split_data(X, y)
        if sha256(train.index.to_numpy(dtype="int64").tobytes()).hexdigest() != report["train_index_sha256"]:
            raise ValueError("Training reference differs from the frozen split.")
        for name, definition in FIELD_DEFINITIONS.items():
            if "options" not in definition:
                observed = [float(train[name].min()), float(train[name].max())]
                if not np.allclose(observed, [definition["minimum"], definition["maximum"]], rtol=0, atol=1e-10):
                    raise ValueError("API support bounds differ from training data.")
        encoder = preprocessor.named_transformers_["categorical"].named_steps["encoder"]
        for name, categories in zip(CATEGORICAL_FEATURES, encoder.categories_, strict=True):
            if set(categories) != set(FIELD_DEFINITIONS[name]["options"]):
                raise ValueError("API categories differ from the fitted encoder.")
        service = cls(pipeline, train, report, artifact_hash, threshold, list(pipeline.classes_).index(1))
        service._predict_frame(validate_inputs(train.iloc[[0]]))
        return service

    def to_frame(self, record: HeartRecord) -> pd.DataFrame:
        """Reuse source validation and exact ordering; no new preprocessing is introduced."""
        try:
            return validate_inputs(pd.DataFrame([record.model_dump()], columns=FEATURES))
        except ValueError as error:
            raise ServiceError(422, "invalid_input", "Input does not match the supported feature contract.") from error

    def _predict_frame(self, frame: pd.DataFrame) -> Prediction:
        score = float(self.pipeline.predict_proba(frame)[0, self.positive_class_index])
        if not np.isfinite(score) or not 0 <= score <= 1:
            raise RuntimeError("Invalid model output.")
        # Historical src/model_utils.py also uses strict '>' at the saved threshold.
        label = int(score > self.threshold)
        return Prediction(class_id=label, class_label=CLASS_LABELS[label], positive_class_score=score, threshold=self.threshold)

    def predict(self, record: HeartRecord) -> Prediction:
        with self.lock:
            return self._predict_frame(self.to_frame(record))

    def metadata(self) -> dict[str, Any]:
        """Allow-list public aggregate information; never expose paths or reference rows."""
        return {"model": MODEL_ID, "algorithm": "Logistic Regression", "dataset": "UCI Heart Disease - processed Cleveland",
                "dataset_url": self.report["dataset_url"], "input_features": FEATURES,
                "transformed_feature_count": 28, "class_labels": {str(key): value for key, value in CLASS_LABELS.items()},
                "artifact_sha256": self.artifact_sha256, "threshold": self.threshold, "research_only": True,
                "evaluation_records": self.report["test_records"],
                "experimental_holdout_metrics": self.report["evaluation"]["metrics"],
                "limitations": ["Experimental metrics from 61 historical holdout records; not validated clinical performance.",
                                "Earlier EDA inspected the full cohort; no independent external validation.",
                                "Scores are uncalibrated model outputs, not real-world disease probabilities.",
                                "Diagnostic features may be unavailable at a proposed decision time."]}


def get_model_service(request: Request) -> ModelService:
    """FastAPI dependency, overrideable in tests without reloading a model."""
    service = getattr(request.app.state, "model_service", None)
    if service is None or not service.initialized:
        raise ServiceError(503, "model_unavailable", "The prediction service is unavailable.")
    return service
