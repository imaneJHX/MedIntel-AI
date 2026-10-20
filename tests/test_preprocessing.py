"""Verify the source contract, original split, and fold-local transformations."""

from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_validate

from src.data_loader import FEATURES, load_heart_data, prepare_target, split_data
from src.preprocessing import NUMERIC_FEATURES, build_pipeline, build_preprocessor


def test_target_mapping(synthetic_data):
    X, _ = synthetic_data
    frame = X.iloc[:5].copy()
    frame["num"] = [0, 1, 2, 3, 4]
    features, target = prepare_target(frame)
    assert target.tolist() == [0, 1, 1, 1, 1]
    assert list(features.columns) == FEATURES
    assert "num" not in features and "heart_disease" not in features


@pytest.mark.parametrize("invalid", [np.nan, -1, 5, 0.5])
def test_invalid_targets_rejected(synthetic_data, invalid):
    frame = synthetic_data[0].copy()
    frame["num"] = 0.0
    frame.loc[0, "num"] = invalid
    with pytest.raises(ValueError, match="Diagnosis"):
        prepare_target(frame)


def test_original_snapshot_and_split():
    path = Path(__file__).resolve().parents[1] / "data/raw/processed.cleveland.data"
    if not path.exists():
        pytest.skip("Optional official-data regression check: run notebook 01 first.")
    X, y = load_heart_data(path)
    train, test, y_train, y_test = split_data(X, y)
    assert X.shape == (303, 13)
    assert X.isna().sum().sum() == 6
    assert not X.assign(num=y).duplicated().any()
    assert train.shape == (242, 13) and test.shape == (61, 13)
    assert train.index[:5].tolist() == [180, 208, 167, 105, 297]
    assert (int(y_train.sum()), int(y_test.sum())) == (111, 28)
    assert train.index.intersection(test.index).empty
    assert set(train.index) | set(test.index) == set(X.index)
    assert train.index.equals(y_train.index) and test.index.equals(y_test.index)
    assert build_preprocessor().fit_transform(train).shape == (242, 28)
    assert split_data(X, y)[0].index.equals(train.index)


def test_loader_rejects_changed_snapshot(tmp_path):
    path = tmp_path / "modified.data"
    path.write_text("not the official snapshot", encoding="utf-8")
    with pytest.raises(ValueError, match="fingerprint"):
        load_heart_data(path)


def test_split_rejects_misaligned_labels(synthetic_data):
    X, y = synthetic_data
    with pytest.raises(ValueError, match="aligned"):
        split_data(X, y.iloc[::-1])


def test_imputation_and_test_transform_do_not_change_statistics(synthetic_data):
    X, _ = synthetic_data
    preprocessor = build_preprocessor()
    train_prepared = preprocessor.fit_transform(X)
    numeric = preprocessor.named_transformers_["numeric"]
    expected = X[NUMERIC_FEATURES].median()
    np.testing.assert_allclose(numeric.named_steps["imputer"].statistics_, expected)
    mean_before = numeric.named_steps["scaler"].mean_.copy()
    test = X.iloc[:3].copy()
    test.loc[:, "age"] = 110.0
    test.loc[:, "thal"] = np.nan
    prepared = preprocessor.transform(test)
    np.testing.assert_array_equal(numeric.named_steps["scaler"].mean_, mean_before)
    assert prepared.shape[1] == train_prepared.shape[1] == 28
    assert np.isfinite(prepared).all()


def test_unseen_category_keeps_output_schema(synthetic_data):
    X, _ = synthetic_data
    preprocessor = build_preprocessor().fit(X)
    probe = X.iloc[[0]].copy()
    probe.loc[:, "cp"] = 999.0
    prepared = preprocessor.transform(probe)
    names = preprocessor.get_feature_names_out()
    assert prepared.shape == (1, 28)
    assert (prepared[:, [name.startswith("categorical__cp_") for name in names]] == 0).all()


def test_preprocessing_is_fitted_inside_each_cv_fold(synthetic_data):
    X, y = synthetic_data
    cv = StratifiedKFold(5, shuffle=True, random_state=42)
    pipeline = build_pipeline(LogisticRegression(max_iter=1000))
    result = cross_validate(pipeline, X, y, cv=cv, return_estimator=True, error_score="raise")
    for (train_indices, _), fitted in zip(cv.split(X, y), result["estimator"]):
        expected = X.iloc[train_indices][NUMERIC_FEATURES].median()
        numeric = fitted.named_steps["preprocessor"].named_transformers_["numeric"]
        np.testing.assert_allclose(numeric.named_steps["imputer"].statistics_, expected)
        assert numeric.named_steps["scaler"].n_samples_seen_ == len(train_indices)
    assert not hasattr(pipeline.named_steps["preprocessor"], "transformers_")
