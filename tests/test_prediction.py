"""Input validation and trusted artifact round-trip tests on synthetic records."""

import numpy as np
import pytest

from src.model_utils import load_pipeline, predict_records, save_pipeline, validate_inputs
from src.train import build_models


@pytest.fixture
def fitted_pipeline(synthetic_data):
    return build_models()["Logistic Regression"].fit(*synthetic_data)


def test_prediction_scores_and_null_measurements(synthetic_data, fitted_pipeline):
    records = synthetic_data[0].iloc[:3].copy()
    records.loc[:, "age"] = np.nan
    result = predict_records(fitted_pipeline, records)
    assert len(result) == 3
    assert all(row["predicted_class"] in [0, 1] and 0 <= row["model_score"] <= 1 for row in result)
    assert all("uncalibrated" in row["score_label"] for row in result)


def test_named_inputs_are_reordered(synthetic_data, fitted_pipeline):
    X, _ = synthetic_data
    expected = predict_records(fitted_pipeline, X.iloc[[3]])
    assert predict_records(fitted_pipeline, X.iloc[[3], ::-1]) == expected
    assert predict_records(fitted_pipeline, X.iloc[3].to_dict()) == expected
    assert predict_records(fitted_pipeline, [X.iloc[3].to_dict()]) == expected


@pytest.mark.parametrize("kind", ["missing_field", "target_leak", "invalid_code", "infinite", "text", "empty_row", "boolean", "negative", "duplicate_column"])
def test_invalid_inputs_rejected(synthetic_data, kind):
    X = synthetic_data[0].iloc[[3]].copy()
    if kind == "missing_field":
        X = X.drop(columns="age")
    elif kind == "target_leak":
        X["heart_disease"] = 1
    elif kind == "invalid_code":
        X.loc[:, "cp"] = 999.0
    elif kind == "infinite":
        X.loc[:, "chol"] = np.inf
    elif kind == "text":
        X["age"] = "unknown"
    elif kind == "empty_row":
        X.loc[:, :] = np.nan
    elif kind == "boolean":
        X["sex"] = True
    elif kind == "negative":
        X.loc[:, "age"] = -1.0
    else:
        X.columns = ["age"] * len(X.columns)
    with pytest.raises(ValueError):
        validate_inputs(X)


@pytest.mark.parametrize("invalid", [None, [], "not a record", [1, 2]])
def test_invalid_structure_rejected(invalid):
    with pytest.raises(ValueError):
        validate_inputs(invalid)


def test_serialization_preserves_predictions(tmp_path, synthetic_data, fitted_pipeline):
    path = save_pipeline(fitted_pipeline, tmp_path / "pipeline.joblib")
    with pytest.raises(ValueError, match="trust"):
        load_pipeline(path)
    restored = load_pipeline(path, trusted=True)
    np.testing.assert_array_equal(restored.predict_proba(synthetic_data[0]), fitted_pipeline.predict_proba(synthetic_data[0]))
    assert predict_records(restored, synthetic_data[0].iloc[:3]) == predict_records(fitted_pipeline, synthetic_data[0].iloc[:3])
    with pytest.raises(FileExistsError):
        save_pipeline(fitted_pipeline, path)
    with pytest.raises(ValueError, match="fingerprint"):
        load_pipeline(path, trusted=True, expected_sha256="wrong")
