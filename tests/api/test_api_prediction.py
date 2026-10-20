"""API scoring equals the existing pipeline and supports explicit imputation."""

import numpy as np
import pandas as pd
import pytest
from pathlib import Path
from src.data_loader import FEATURES


def test_prediction_matches_direct_model(api_client, api_application, clinical_record):
    response = api_client.post("/api/v1/predict/heart-disease", json=clinical_record)
    assert response.status_code == 200
    body = response.json()
    prediction = body["prediction"]
    service = api_application.state.model_service
    direct = service.pipeline.predict_proba(pd.DataFrame([clinical_record], columns=FEATURES))[0, list(service.pipeline.classes_).index(1)]
    assert prediction["positive_class_score"] == pytest.approx(float(direct), abs=1e-14)
    assert prediction["class_id"] == int(direct > service.threshold)
    assert prediction["threshold"] == service.report["threshold"]
    assert np.isfinite(prediction["positive_class_score"]) and 0 <= prediction["positive_class_score"] <= 1
    assert "uncalibrated" in prediction["score_semantics"]


def test_order_independence_and_repeated_requests(api_client, clinical_record):
    expected = api_client.post("/api/v1/predict/heart-disease", json=clinical_record).json()
    reordered = dict(reversed(list(clinical_record.items())))
    assert api_client.post("/api/v1/predict/heart-disease", json=reordered).json() == expected
    assert api_client.post("/api/v1/predict/heart-disease", json=clinical_record).json() == expected


def test_explicit_nulls_use_frozen_imputer(api_client, api_application, clinical_record):
    clinical_record.update(age=None, ca=None, thal=None)
    response = api_client.post("/api/v1/predict/heart-disease", json=clinical_record)
    assert response.status_code == 200
    frame = pd.DataFrame([clinical_record], columns=FEATURES).astype(float)
    expected = api_application.state.model_service.pipeline.predict_proba(frame)[0, 1]
    assert response.json()["prediction"]["positive_class_score"] == pytest.approx(float(expected))


def test_requests_do_not_read_files_or_rebuild_resources(api_client, monkeypatch, clinical_record):
    def forbidden(*args, **kwargs):
        raise AssertionError("Request inference must not reload files or rebuild a background.")

    monkeypatch.setattr(Path, "read_bytes", forbidden)
    monkeypatch.setattr("app.services.model_service.load_pipeline", forbidden)
    monkeypatch.setattr("app.services.explainability_service.build_explainer", forbidden)
    for _ in range(2):
        assert api_client.post("/api/v1/predict/heart-disease", json=clinical_record).status_code == 200
        assert api_client.post("/api/v1/explain/heart-disease", json=clinical_record).status_code == 200
        assert api_client.get("/api/v1/ready").status_code == 200
