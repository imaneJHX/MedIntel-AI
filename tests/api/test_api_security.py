"""Privacy, lifecycle, size enforcement, and a deliberately limited CORS policy."""

import asyncio
from hashlib import sha256
import logging
from pathlib import Path
import shutil

from fastapi.testclient import TestClient
import pytest
from pydantic import ValidationError
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from app.core.config import Settings
from app.core.security import PrivacyMiddleware
from app.main import create_app
from app.services.model_service import get_model_service


def test_cors_allowlist_and_preflight_errors(api_client):
    allowed = api_client.options("/api/v1/predict/heart-disease", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
    assert allowed.status_code == 200 and allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-credentials" not in allowed.headers
    denied = api_client.options("/api/v1/predict/heart-disease", headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"})
    assert denied.status_code == 400 and denied.json()["error"]["code"] == "cors_not_allowed"
    assert "access-control-allow-origin" not in denied.headers
    simple = api_client.get("/api/v1/health", headers={"Origin": "https://untrusted.example"})
    assert "access-control-allow-origin" not in simple.headers


@pytest.mark.parametrize("origin", ["*", "https://example.com/path", "javascript:bad", "https://user:password@example.com"])
def test_unsafe_cors_configuration_rejected(origin):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, cors_origins=[origin], cors_allow_credentials=True)


def test_size_limits_check_actual_body_not_only_content_length(api_client, clinical_record):
    huge = b" " * 20_000
    for extra_headers in [{}, {"Content-Length": "0"}]:
        response = api_client.post("/api/v1/predict/heart-disease", content=huge,
                                   headers={"Content-Type": "application/json", "Origin": "http://localhost:5173", **extra_headers})
        assert response.status_code == 413 and response.json()["error"]["code"] == "request_too_large"
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert api_client.post("/api/v1/predict/heart-disease", json=clinical_record).status_code == 200


def test_streamed_body_limit():
    async def scenario():
        events = iter([{"type": "http.request", "body": b"123456", "more_body": True},
                       {"type": "http.request", "body": b"789012", "more_body": False}])
        captured = []

        async def receive():
            return next(events)

        async def send(message):
            captured.append(message)

        async def forbidden_application(*args):
            raise AssertionError("Oversize streamed body must not reach the application.")

        middleware = PrivacyMiddleware(forbidden_application, max_request_bytes=10)
        await middleware({"type": "http", "method": "POST", "headers": [(b"content-type", b"application/json")]}, receive, send)
        assert captured[0]["status"] == 413
    asyncio.run(scenario())


def test_no_body_or_internal_exception_details_in_logs_or_errors(api_client, api_application, clinical_record, caplog):
    marker = "PRIVATE_CLINICAL_MARKER"
    caplog.set_level(logging.INFO)
    invalid = api_client.post("/api/v1/predict/heart-disease", json={**clinical_record, "notes": marker})
    assert invalid.status_code == 422 and marker not in invalid.text

    def broken_dependency():
        raise RuntimeError(f"{marker}: C:\\private\\weights.joblib")

    api_application.dependency_overrides[get_model_service] = broken_dependency
    try:
        response = api_client.post("/api/v1/predict/heart-disease", json=clinical_record, headers={"Origin": "http://localhost:5173"})
        assert response.status_code == 500
        assert response.json()["error"]["code"] == "internal_error"
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
        assert marker not in response.text and "private" not in response.text and "Traceback" not in response.text
    finally:
        api_application.dependency_overrides.pop(get_model_service)
    assert marker not in caplog.text and "weights.joblib" not in caplog.text


def test_response_cache_and_mime_headers(api_client):
    response = api_client.get("/api/v1/models/heart-disease")
    assert response.headers["cache-control"] == "no-store" and response.headers["x-content-type-options"] == "nosniff"
    for method, path in [("get", "/not-an-endpoint"), ("delete", "/api/v1/health")]:
        error = getattr(api_client, method)(path)
        assert error.status_code in [404, 405] and "error" in error.json()


def test_missing_model_is_controlled_and_liveness_survives(tmp_path):
    root = Path(__file__).resolve().parents[2]
    destination = tmp_path / "reports/metrics"
    destination.mkdir(parents=True)
    shutil.copyfile(root / "reports/metrics/experiment.json", destination / "experiment.json")
    with TestClient(create_app(Settings(_env_file=None, project_root=tmp_path))) as client:
        assert client.get("/api/v1/health").status_code == 200
        response = client.get("/api/v1/ready")
        assert response.status_code == 503 and response.json()["error"]["code"] == "model_unavailable"
        assert str(tmp_path) not in response.text


def test_failed_explainer_leaves_prediction_available(clinical_record):
    def fail(service):
        raise RuntimeError("private initialization details")

    with TestClient(create_app(Settings(_env_file=None), explanation_builder=fail)) as client:
        assert client.get("/api/v1/ready").status_code == 503
        assert client.post("/api/v1/predict/heart-disease", json=clinical_record).status_code == 200
        error = client.post("/api/v1/explain/heart-disease", json=clinical_record)
        assert error.status_code == 503 and "private" not in error.text


def test_load_once_never_fit_and_preserve_artifact(monkeypatch, clinical_record):
    import app.services.model_service as module
    original_loader = module.load_pipeline
    calls = []
    root = Path(__file__).resolve().parents[2]
    artifact = root / "models/heart_disease_pipeline.joblib"
    before = sha256(artifact.read_bytes()).hexdigest()

    def counted(*args, **kwargs):
        calls.append(1)
        return original_loader(*args, **kwargs)

    def no_training(*args, **kwargs):
        raise AssertionError("The backend must never fit any component.")

    monkeypatch.setattr(module, "load_pipeline", counted)
    for cls in [Pipeline, ColumnTransformer, LogisticRegression]:
        monkeypatch.setattr(cls, "fit", no_training)
    with TestClient(create_app(Settings(_env_file=None))) as client:
        for _ in range(2):
            assert client.post("/api/v1/predict/heart-disease", json=clinical_record).status_code == 200
            assert client.post("/api/v1/explain/heart-disease", json=clinical_record).status_code == 200
    assert len(calls) == 1 and sha256(artifact.read_bytes()).hexdigest() == before
