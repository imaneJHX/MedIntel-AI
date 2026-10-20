"""Liveness, readiness, public metadata, and machine-readable documentation."""

from app.schemas.patient import FIELD_DEFINITIONS
from src.data_loader import FEATURES


def test_liveness_and_readiness(api_client):
    response = api_client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "MedIntel AI", "version": "1.0.0"}
    assert api_client.get("/api/v1/ready").json() == {"status": "ready", "model_loaded": True, "explainer_initialized": True}


def test_public_model_metadata(api_client):
    response = api_client.get("/api/v1/models/heart-disease")
    assert response.status_code == 200
    data = response.json()
    assert data["model"] == "heart-disease-logistic-regression" and data["algorithm"] == "Logistic Regression"
    assert data["input_features"] == FEATURES and data["transformed_feature_count"] == 28
    assert data["research_only"] and data["evaluation_records"] == 61
    assert "Not a medical diagnosis" in data["disclaimer"]
    assert "training_reference" not in response.text and "C:\\" not in response.text


def test_form_schema_matches_shared_contract(api_client):
    data = api_client.get("/api/v1/models/heart-disease/schema").json()
    assert [field["name"] for field in data["fields"]] == FEATURES
    assert all(field["required"] and field["nullable"] for field in data["fields"])
    for field in data["fields"]:
        source = FIELD_DEFINITIONS[field["name"]]
        assert [option["value"] for option in field["options"]] == list(source.get("options", {}))
        assert field["minimum"] == source.get("minimum") and field["maximum"] == source.get("maximum")


def test_openapi_and_docs(api_client):
    result = api_client.get("/openapi.json")
    assert result.status_code == 200
    schema = result.json()
    assert len(schema["paths"]) == 8
    record = schema["components"]["schemas"]["HeartRecord"]
    assert record["required"] == FEATURES and record["additionalProperties"] is False
    assert schema["paths"]["/api/v1/predict/heart-disease"]["post"]["responses"]["422"]["content"]["application/json"]["schema"]["$ref"].endswith("ErrorResponse")
    assert api_client.get("/docs").status_code == 200 and api_client.get("/redoc").status_code == 200
