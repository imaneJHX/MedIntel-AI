"""Differentiate types, missing fields, category errors, and unsupported ranges."""

import json
import pytest


@pytest.mark.parametrize("field,value,code", [
    ("age", "55", "float_type"), ("age", True, "float_type"), ("age", -1, "greater_than_equal"),
    ("age", 78, "less_than_equal"), ("chol", 0, "greater_than_equal"),
    ("oldpeak", 7, "less_than_equal"), ("cp", 5, "unknown_category"),
    ("thal", 0, "unknown_category"), ("ca", 4, "unknown_category"),
    ("sex", True, "int_type"), ("cp", 4.0, "int_type"),
])
def test_invalid_values(api_client, clinical_record, field, value, code):
    clinical_record[field] = value
    response = api_client.post("/api/v1/predict/heart-disease", json=clinical_record)
    assert response.status_code == 422
    assert any(item["field"] == field and item["code"] == code for item in response.json()["error"]["details"])


def test_missing_and_extra_fields(api_client, clinical_record):
    del clinical_record["age"]
    missing = api_client.post("/api/v1/predict/heart-disease", json=clinical_record)
    assert missing.status_code == 422 and missing.json()["error"]["details"][0]["code"] == "missing"
    clinical_record.update(age=55, patient_name="PRIVATE_MARKER_NOT_ALLOWED")
    extra = api_client.post("/api/v1/predict/heart-disease", json=clinical_record)
    assert extra.status_code == 422
    assert "PRIVATE_MARKER" not in extra.text and "patient_name" not in extra.text
    assert extra.json()["error"]["details"][0]["code"] == "extra_forbidden"


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
def test_non_finite_json_constants_rejected_safely(api_client, clinical_record, value):
    clinical_record["oldpeak"] = value
    response = api_client.post("/api/v1/predict/heart-disease", content=json.dumps(clinical_record), headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "finite_number"
    assert "NaN" not in response.text and "Infinity" not in response.text


@pytest.mark.parametrize("body", [[], [1, 2], None, 42, "a record"])
def test_single_object_required(api_client, body):
    response = api_client.post("/api/v1/predict/heart-disease", content=json.dumps(body), headers={"Content-Type": "application/json"})
    assert response.status_code == 422


def test_entirely_null_record_rejected(api_client, clinical_record):
    response = api_client.post("/api/v1/predict/heart-disease", json={name: None for name in clinical_record})
    assert response.status_code == 422 and response.json()["error"]["details"][0]["code"] == "empty_record"


def test_malformed_json_and_unsupported_body_formats(api_client):
    path = "/api/v1/predict/heart-disease"
    malformed = api_client.post(path, content='{"age":', headers={"Content-Type": "application/json"})
    assert malformed.status_code == 400 and malformed.json()["error"]["code"] == "malformed_json"
    assert api_client.post(path, content="age=55", headers={"Content-Type": "text/plain"}).status_code == 415
    compressed = api_client.post(path, content="{}", headers={"Content-Type": "application/json", "Content-Encoding": "gzip"})
    assert compressed.status_code == 415
