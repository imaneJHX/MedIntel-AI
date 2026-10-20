"""Explain the frozen artifact without changing it or fitting preprocessing/model state."""

from hashlib import sha256
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest
from scipy.special import expit
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from src.data_loader import FEATURES, load_heart_data, split_data
from src.explainability import (
    build_explainer, explain_global, explain_individual, feature_mapping, global_importance,
    group_contributions, load_explanation_model, load_explainability_report, select_examples, transform_records, validate_reconstruction,
)


@pytest.fixture(scope="module")
def context():
    root = Path(__file__).resolve().parents[1]
    if not (root / "models/heart_disease_pipeline.joblib").exists():
        pytest.skip("Run Phase 3 first; these tests require the trusted frozen artifact.")
    model = load_explanation_model(root, trusted=True)
    X, y = load_heart_data(root / "data/raw/processed.cleveland.data")
    train, test, _, labels = split_data(X, y)
    engine = build_explainer(model, train)
    return engine, train, test, labels


def test_frozen_model_type_and_load_guard(context):
    engine, _, _, _ = context
    assert isinstance(engine.pipeline.named_steps["classifier"], LogisticRegression)
    root = Path(__file__).resolve().parents[1]
    with pytest.raises(ValueError, match="trust"):
        load_explanation_model(root)


def test_names_align_with_coefficients_and_category_metadata(context):
    engine, _, test, _ = context
    mapping = feature_mapping(engine.pipeline)
    assert mapping["transformed_feature"].tolist() == engine.pipeline.named_steps["preprocessor"].get_feature_names_out().tolist()
    assert len(mapping) == engine.pipeline.named_steps["classifier"].coef_.shape[1] == 28
    assert set(mapping["original_feature"]) == set(FEATURES)
    assert mapping.loc[mapping["original_feature"] == "cp", "category"].tolist() == [1, 2, 3, 4]
    assert transform_records(engine.pipeline, test).columns.tolist() == mapping["transformed_feature"].tolist()


def test_training_background_has_no_hidden_subsampling_or_holdout_rows(context):
    engine, train, test, _ = context
    assert train.index.intersection(test.index).empty
    assert engine.background_records == len(train) == 242
    assert engine.explainer.masker.data.shape == (242, 28)
    expected = transform_records(engine.pipeline, train).mean().to_numpy()
    np.testing.assert_allclose(engine.background_mean, expected, atol=1e-12, rtol=0)
    np.testing.assert_allclose(engine.explainer.masker.data.mean(axis=0), expected, atol=1e-12, rtol=0)


def test_shap_dimensions_finiteness_and_baseline(context):
    engine, _, test, _ = context
    values = explain_global(engine, test)
    assert values.values.shape == (61, 28)
    assert np.isfinite(values.values).all() and np.isfinite(values.base_values).all()
    assert values.base_values.shape == (61,)


def test_log_odds_and_sigmoid_reconstruction(context):
    engine, _, test, _ = context
    values = explain_global(engine, test)
    diagnostics = validate_reconstruction(engine, test, values)
    assert diagnostics["max_log_odds_error"] < 1e-10
    assert diagnostics["max_score_error"] < 1e-12
    assert diagnostics["max_analytic_contribution_error"] < 1e-10
    reconstructed = values.base_values + values.values.sum(axis=1)
    np.testing.assert_allclose(expit(reconstructed), engine.pipeline.predict_proba(test)[:, 1], rtol=0, atol=1e-12)


def test_individual_matches_global(context):
    engine, _, test, _ = context
    individual = explain_individual(engine, test.iloc[[0]])
    all_values = explain_global(engine, test.iloc[:2])
    np.testing.assert_array_equal(individual.values, all_values.values[0])
    np.testing.assert_equal(individual.base_values, all_values.base_values[0])


def test_grouping_preserves_signed_contributions_and_absolute_magnitudes(context):
    engine, _, test, _ = context
    values = explain_global(engine, test)
    signed = group_contributions(values, engine.mapping)
    transformed, grouped = global_importance(values, engine.mapping)
    assert signed.shape == (61, 13)
    np.testing.assert_allclose(signed.sum(axis=1), values.values.sum(axis=1), atol=1e-10, rtol=0)
    np.testing.assert_allclose(grouped["sum_mean_absolute_shap"].sum(), transformed["mean_absolute_shap"].sum())
    assert (grouped["sum_mean_absolute_shap"] + 1e-12 >= grouped["mean_absolute_net_shap"]).all()
    cp_mask = engine.mapping["original_feature"].eq("cp").to_numpy()
    np.testing.assert_allclose(signed["cp"], values.values[:, cp_mask].sum(axis=1))


def test_wrong_mapping_order_rejected(context):
    engine, _, test, _ = context
    values = explain_global(engine, test.iloc[:2])
    with pytest.raises(ValueError, match="order"):
        group_contributions(values, engine.mapping.iloc[::-1])


@pytest.mark.parametrize("invalid", [None, pd.DataFrame(), {"age": 50}])
def test_invalid_record_structure_rejected(context, invalid):
    with pytest.raises(ValueError):
        explain_global(context[0], invalid)


def test_invalid_categories_and_multiple_individual_records_rejected(context):
    engine, _, test, _ = context
    invalid = test.iloc[[0]].copy()
    invalid.loc[:, "cp"] = 999
    with pytest.raises(ValueError, match="cp"):
        explain_global(engine, invalid)
    with pytest.raises(ValueError, match="exactly one"):
        explain_individual(engine, test.iloc[:2])


def test_no_fit_calls_and_no_model_mutation(context, monkeypatch):
    engine, train, test, _ = context
    before = joblib.hash(engine.pipeline)
    path = Path(__file__).resolve().parents[1] / "models/heart_disease_pipeline.joblib"
    artifact_before = sha256(path.read_bytes()).hexdigest()

    def forbidden_fit(*args, **kwargs):
        raise AssertionError("Explanation code must not fit any preprocessing or classifier.")

    for cls in [Pipeline, ColumnTransformer, LogisticRegression]:
        monkeypatch.setattr(cls, "fit", forbidden_fit)
    fresh_engine = build_explainer(engine.pipeline, train)
    explain_global(fresh_engine, test)
    assert joblib.hash(engine.pipeline) == before
    assert sha256(path.read_bytes()).hexdigest() == artifact_before


def test_reproducible_explanations_for_identical_background(context):
    engine, train, test, _ = context
    second = build_explainer(engine.pipeline, train)
    first_values = explain_global(engine, test)
    second_values = explain_global(second, test)
    np.testing.assert_array_equal(first_values.values, second_values.values)
    np.testing.assert_array_equal(first_values.base_values, second_values.base_values)


def test_examples_are_first_matching_split_positions(context):
    engine, _, test, labels = context
    scores = engine.pipeline.predict_proba(test)[:, 1]
    examples = select_examples(scores, labels)
    predicted = (scores > 0.5).astype(int)
    assert examples["positive"] == int(np.flatnonzero(predicted == 1)[0])
    assert examples["negative"] == int(np.flatnonzero(predicted == 0)[0])
    mistakes = np.flatnonzero(predicted != labels.to_numpy())
    unused = [int(position) for position in mistakes if position not in [examples["positive"], examples["negative"]]]
    assert examples["misclassified"] == (unused[0] if unused else int(mistakes[0]))
    assert len(set(examples.values())) == 3


def test_generated_xai_report_integrity():
    root = Path(__file__).resolve().parents[1]
    if not (root / "reports/metrics/explainability.json").exists():
        pytest.skip("Optional generated-output check: run Phase 4 first.")
    report = load_explainability_report(root)
    assert report["explained_records"] == 61 and report["background_records"] == 242
    assert report["transformed_feature_count"] == 28 and len(report["figures"]) == 6
    assert report["diagnostics"]["max_log_odds_error"] < 1e-10
    assert report["diagnostics"]["max_score_error"] < 1e-12
    assert len({sample["holdout_position"] for sample in report["examples"].values()}) == 3
