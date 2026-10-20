"""Test selection policy and reproducibility without scoring the real holdout."""

import numpy as np
import pandas as pd
import pytest

from src.evaluate import evaluate_predictions
from src.train import build_models, compare_models, run_experiment, select_model


@pytest.mark.parametrize("name", ["Logistic Regression", "Random Forest", "XGBoost"])
def test_fixed_seed_predictions_repeat(synthetic_data, name):
    X, y = synthetic_data
    first = build_models()[name].fit(X, y)
    second = build_models()[name].fit(X, y)
    np.testing.assert_allclose(first.predict_proba(X), second.predict_proba(X), atol=0, rtol=0)
    assert set(first.predict(X)).issubset({0, 1})


def test_selection_prioritizes_recall_with_precision_guardrail():
    table = pd.DataFrame([
        {"model": "high accuracy", "accuracy_mean": 0.95, "precision_mean": 0.9, "recall_mean": 0.7, "f1_mean": 0.79, "roc_auc_mean": 0.9},
        {"model": "balanced recall", "accuracy_mean": 0.85, "precision_mean": 0.8, "recall_mean": 0.9, "f1_mean": 0.85, "roc_auc_mean": 0.88},
        {"model": "excess false positives", "accuracy_mean": 0.5, "precision_mean": 0.5, "recall_mean": 1.0, "f1_mean": 0.66, "roc_auc_mean": 0.5},
    ])
    assert select_model(table) == "balanced recall"
    assert select_model(table.iloc[[2]]) == "excess false positives"  # documented fallback


def test_comparison_uses_only_supplied_training_rows(synthetic_data, monkeypatch):
    import src.train as training
    from sklearn.model_selection import cross_validate as real_cross_validate

    X, y = synthetic_data
    X_train, X_test = X.iloc[:48], X.iloc[48:]
    y_train = y.iloc[:48]
    calls = []

    def checked_cross_validate(estimator, features, labels, **kwargs):
        assert features.index.equals(X_train.index)
        assert features.index.intersection(X_test.index).empty
        assert not hasattr(estimator.named_steps["preprocessor"], "transformers_")
        calls.append(type(estimator.named_steps["classifier"]).__name__)
        return real_cross_validate(estimator, features, labels, **kwargs)

    monkeypatch.setattr(training, "cross_validate", checked_cross_validate)
    summary, folds = compare_models(X_train, y_train)
    assert len(calls) == 3 and len(summary) == 3 and len(folds) == 15
    assert folds.groupby("model").size().eq(5).all()
    assert summary.filter(regex="_mean$").notna().all().all()


def test_existing_artifacts_are_preserved(tmp_path):
    artifact = tmp_path / "models/heart_disease_pipeline.joblib"
    artifact.parent.mkdir()
    artifact.write_bytes(b"preserve this artifact")
    with pytest.raises(FileExistsError):
        run_experiment(tmp_path)
    assert artifact.read_bytes() == b"preserve this artifact"


def test_metrics_and_confusion_matrix_are_correct():
    # Deliberately small synthetic labels: TN=2, FP=1, FN=1, TP=2.
    result = evaluate_predictions(np.array([0, 0, 0, 1, 1, 1]),
                                  np.array([0, 0, 1, 0, 1, 1]),
                                  np.array([0.1, 0.2, 0.8, 0.3, 0.7, 0.9]))
    assert result["confusion_matrix"] == [[2, 1], [1, 2]]
    assert result["metrics"]["accuracy"] == pytest.approx(4 / 6)
    assert result["metrics"]["sensitivity"] == pytest.approx(2 / 3)
    assert result["metrics"]["specificity"] == pytest.approx(2 / 3)
    assert 0 <= result["metrics"]["brier_score"] <= 1
    for lower, upper in result["intervals_95"].values():
        assert 0 <= lower <= upper <= 1
