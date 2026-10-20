"""One centralized 13-field UCI contract, checked against training support at startup."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator
from pydantic_core import PydanticCustomError

from src.data_loader import FEATURES

# Numeric bounds are observed TRAINING minima/maxima, not medical normality thresholds.
FIELD_DEFINITIONS: dict[str, dict[str, Any]] = {
    "age": {"label": "Age", "unit": "years", "description": "Age at observation.", "minimum": 29.0, "maximum": 77.0},
    "sex": {"label": "Recorded sex", "unit": None, "description": "Sex coding in the historical UCI source.", "options": {0: "Female", 1: "Male"}},
    "cp": {"label": "Chest-pain type", "unit": None, "description": "Original UCI chest-pain category.", "options": {1: "Typical angina", 2: "Atypical angina", 3: "Non-anginal pain", 4: "Asymptomatic"}},
    "trestbps": {"label": "Resting blood pressure", "unit": "mm Hg", "description": "Resting blood pressure recorded on hospital admission.", "minimum": 94.0, "maximum": 200.0},
    "chol": {"label": "Serum cholesterol", "unit": "mg/dL", "description": "Recorded serum cholesterol.", "minimum": 126.0, "maximum": 564.0},
    "fbs": {"label": "Fasting blood sugar indicator", "unit": None, "description": "Dataset indicator for fasting blood sugar above 120 mg/dL; this is a source definition, not a recommendation.", "options": {0: "False", 1: "True"}},
    "restecg": {"label": "Resting ECG", "unit": None, "description": "Original resting ECG result code.", "options": {0: "Normal", 1: "ST-T abnormality", 2: "Probable/definite left ventricular hypertrophy"}},
    "thalach": {"label": "Maximum heart rate", "unit": "beats/min", "description": "Maximum heart rate achieved.", "minimum": 71.0, "maximum": 202.0},
    "exang": {"label": "Exercise-induced angina", "unit": None, "description": "Recorded exercise-angina indicator.", "options": {0: "No", 1: "Yes"}},
    "oldpeak": {"label": "Exercise ST depression", "unit": None, "description": "ST depression relative to rest; the UCI field documentation does not specify units.", "minimum": 0.0, "maximum": 6.2},
    "slope": {"label": "Peak exercise ST slope", "unit": None, "description": "Original ST-segment slope category.", "options": {1: "Upsloping", 2: "Flat", 3: "Downsloping"}},
    "ca": {"label": "Major vessels visualized", "unit": "count", "description": "Major vessels visualized by fluoroscopy, treated as a discrete category.", "options": {0: "0", 1: "1", 2: "2", 3: "3"}},
    "thal": {"label": "Thallium-test result", "unit": None, "description": "Original test-result code; not a thalassemia diagnosis.", "options": {3: "Normal", 6: "Fixed defect", 7: "Reversible defect"}},
}
DEMO_RECORD = {"age": 55, "sex": 1, "cp": 4, "trestbps": 140, "chol": 240, "fbs": 0, "restecg": 0,
               "thalach": 150, "exang": 0, "oldpeak": 1.0, "slope": 2, "ca": 0, "thal": 3}


def _field(name: str) -> Any:
    definition = FIELD_DEFINITIONS[name]
    extra: dict[str, Any] = {"unit": definition["unit"], "nullable": True}
    bounds: dict[str, Any] = {}
    if "options" in definition:
        extra["enum"] = [*definition["options"], None]
    else:
        bounds = {"ge": definition["minimum"], "le": definition["maximum"]}
        extra["range_semantics"] = "Observed training support; not medical normality."
    return Field(..., title=definition["label"], description=definition["description"], json_schema_extra=extra, **bounds)


class HeartRecord(BaseModel):
    """All keys are required; explicit nulls use the frozen training-fitted imputer."""

    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False, json_schema_extra={"examples": [DEMO_RECORD]})
    age: float | None = _field("age")
    sex: int | None = _field("sex")
    cp: int | None = _field("cp")
    trestbps: float | None = _field("trestbps")
    chol: float | None = _field("chol")
    fbs: int | None = _field("fbs")
    restecg: int | None = _field("restecg")
    thalach: float | None = _field("thalach")
    exang: int | None = _field("exang")
    oldpeak: float | None = _field("oldpeak")
    slope: int | None = _field("slope")
    ca: int | None = _field("ca")
    thal: int | None = _field("thal")

    @field_validator("sex", "cp", "fbs", "restecg", "exang", "slope", "ca", "thal")
    @classmethod
    def known_category(cls, value: int | None, info: ValidationInfo) -> int | None:
        if value is not None and value not in FIELD_DEFINITIONS[info.field_name]["options"]:
            raise PydanticCustomError("unknown_category", "Use a documented UCI category or null.")
        return value

    @model_validator(mode="after")
    def not_entirely_null(self) -> "HeartRecord":
        if all(value is None for value in self.model_dump().values()):
            raise PydanticCustomError("empty_record", "At least one input must be non-null.")
        return self


def schema_fields() -> list[dict[str, Any]]:
    """Expose the same validation contract as form-ready labels, ranges, and options."""
    return [{"name": name, "label": info["label"], "type": "integer" if "options" in info else "number",
             "unit": info["unit"], "description": info["description"], "required": True, "nullable": True,
             "minimum": info.get("minimum"), "maximum": info.get("maximum"),
             "options": [{"value": value, "label": label} for value, label in info.get("options", {}).items()]}
            for name, info in FIELD_DEFINITIONS.items()]


assert list(FIELD_DEFINITIONS) == list(HeartRecord.model_fields) == FEATURES
