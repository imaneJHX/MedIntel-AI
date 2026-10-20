"""The returned JSON preserves exact feature order and additive log-odds math."""

import numpy as np
import pytest
from scipy.special import expit


def test_explanation_alignment_and_reconstruction(api_client, api_application, clinical_record):
    response = api_client.post("/api/v1/explain/heart-disease", json=clinical_record)
    assert response.status_code == 200
    body = response.json()
    explanation = body["explanation"]
    expected_names = api_application.state.model_service.pipeline.named_steps["preprocessor"].get_feature_names_out().tolist()
    assert [item["feature"] for item in explanation["feature_contributions"]] == expected_names
    assert len(explanation["feature_contributions"]) == 28
    assert explanation["background_records"] == 242 and explanation["units"] == "positive-class log-odds"
    total = explanation["baseline_log_odds"] + sum(item["contribution_log_odds"] for item in explanation["feature_contributions"])
    assert total == pytest.approx(explanation["model_output_log_odds"], abs=1e-10)
    assert expit(total) == pytest.approx(body["prediction"]["positive_class_score"], abs=1e-12)
    assert explanation["max_reconstruction_error"] < 1e-10
    assert all(item["contribution_log_odds"] > 0 for item in explanation["top_positive_contributors"])
    assert all(item["contribution_log_odds"] < 0 for item in explanation["top_negative_contributors"])
    assert explanation["top_positive_contributors"] and explanation["top_negative_contributors"]
    assert set(explanation["input_values"]) == set(clinical_record)


def test_baseline_is_training_reference_not_submitted_record(api_client, clinical_record):
    first = api_client.post("/api/v1/explain/heart-disease", json=clinical_record).json()
    clinical_record.update(age=65, oldpeak=2.0)
    second = api_client.post("/api/v1/explain/heart-disease", json=clinical_record).json()
    assert first["explanation"]["baseline_log_odds"] == second["explanation"]["baseline_log_odds"]
    assert first["prediction"]["positive_class_score"] != second["prediction"]["positive_class_score"]
    assert np.isfinite(second["explanation"]["model_output_log_odds"])


def test_explanation_repeats_and_rejects_invalid_input(api_client, clinical_record):
    first = api_client.post("/api/v1/explain/heart-disease", json=clinical_record).json()
    assert api_client.post("/api/v1/explain/heart-disease", json=clinical_record).json() == first
    clinical_record["thal"] = 99
    invalid = api_client.post("/api/v1/explain/heart-disease", json=clinical_record)
    assert invalid.status_code == 422 and invalid.json()["error"]["details"][0]["code"] == "unknown_category"
