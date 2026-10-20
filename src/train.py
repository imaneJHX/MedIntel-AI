"""Reproducible training-only model selection and one fixed holdout evaluation.

Run from the repository root: python -m src.train
"""

import argparse
from hashlib import sha256
import importlib.metadata
import json
import logging
from pathlib import Path
import platform
from typing import Any

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, make_scorer, precision_score, recall_score, f1_score
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier

from .data_loader import DATA_SHA256, DATA_URL, FEATURES, RANDOM_STATE, load_heart_data, split_data
from .evaluate import FIGURE_NAMES, evaluate_predictions, save_figures
from .model_utils import load_pipeline, save_pipeline
from .preprocessing import build_pipeline

LOGGER = logging.getLogger(__name__)
METRICS = ["accuracy", "precision", "recall", "f1", "roc_auc", "brier_score"]
SELECTION_RULE = "Among models with mean CV precision >= 0.60, maximize mean recall; break ties by F1, ROC-AUC, then original order (Logistic Regression first). If none meet 0.60, maximize F1 then recall and ROC-AUC. Threshold 0.5 is fixed; no test-based tuning."


def build_models() -> dict[str, Pipeline]:
    """Return three complete, fresh pipelines with modest fixed configurations."""
    return {
        "Logistic Regression": build_pipeline(LogisticRegression(
            C=1.0, max_iter=2000, solver="lbfgs", class_weight="balanced", random_state=RANDOM_STATE,
        )),
        "Random Forest": build_pipeline(RandomForestClassifier(
            n_estimators=200, max_depth=4, min_samples_leaf=3,
            class_weight="balanced", random_state=RANDOM_STATE, n_jobs=1,
        )),
        "XGBoost": build_pipeline(XGBClassifier(
            n_estimators=150, max_depth=2, learning_rate=0.05, min_child_weight=3,
            subsample=0.9, colsample_bytree=0.9, reg_lambda=2.0,
            objective="binary:logistic", eval_metric="logloss", tree_method="hist",
            random_state=RANDOM_STATE, n_jobs=1,
        )),
    }


def compare_models(X_train: pd.DataFrame, y_train: pd.Series) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Compare full pipelines on training folds only; this API accepts no holdout."""
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    scoring = {
        "accuracy": "accuracy", "roc_auc": "roc_auc", "brier_score": "neg_brier_score",
        "precision": make_scorer(precision_score, zero_division=0),
        "recall": make_scorer(recall_score, zero_division=0),
        "f1": make_scorer(f1_score, zero_division=0),
    }
    rows, fold_rows = [], []
    for name, pipeline in build_models().items():
        LOGGER.info("Five-fold training comparison: %s", name)
        results = cross_validate(pipeline, X_train, y_train, cv=cv, scoring=scoring,
                                 return_train_score=True, n_jobs=1, error_score="raise")
        row: dict[str, Any] = {"model": name}
        for metric in METRICS:
            values = results[f"test_{metric}"] * (-1 if metric == "brier_score" else 1)
            row[f"{metric}_mean"] = float(np.mean(values))
            row[f"{metric}_std"] = float(np.std(values, ddof=1))
        row["train_accuracy_mean"] = float(np.mean(results["train_accuracy"]))
        row["train_roc_auc_mean"] = float(np.mean(results["train_roc_auc"]))
        row["accuracy_gap"] = row["train_accuracy_mean"] - row["accuracy_mean"]
        rows.append(row)
        for fold in range(5):
            fold_rows.append({
                "model": name, "fold": fold + 1,
                **{metric: float(results[f"test_{metric}"][fold]) * (-1 if metric == "brier_score" else 1) for metric in METRICS},
                "train_accuracy": float(results["train_accuracy"][fold]),
                "train_roc_auc": float(results["train_roc_auc"][fold]),
            })
    return pd.DataFrame(rows), pd.DataFrame(fold_rows)


def select_model(comparison: pd.DataFrame) -> str:
    """Apply the predeclared precision guardrail and recall-prioritized CV rule."""
    eligible = comparison.loc[comparison["precision_mean"] >= 0.60]
    order = ["recall_mean", "f1_mean", "roc_auc_mean"]
    if eligible.empty:
        eligible = comparison
        order = ["f1_mean", "recall_mean", "roc_auc_mean"]
    if eligible.empty or not np.isfinite(eligible[order].to_numpy()).all():
        raise ValueError("Finite cross-validation results are required for selection.")
    return str(eligible.sort_values(order, ascending=False, kind="stable").iloc[0]["model"])


def _implementation_hash() -> str:
    """Fingerprint the reusable implementation to reject stale notebook caches."""
    files = ["data_loader.py", "preprocessing.py", "train.py", "evaluate.py", "model_utils.py"]
    return sha256(b"".join((Path(__file__).parent / name).read_bytes() for name in files)).hexdigest()


def load_experiment_report(project_root: str | Path) -> dict[str, Any]:
    """Reuse a completed run only when its code, data, versions, and files match."""
    root = Path(project_root)
    report = json.loads((root / "reports/metrics/experiment.json").read_text(encoding="utf-8"))
    if report["implementation_sha256"] != _implementation_hash():
        raise ValueError("Implementation changed; explicitly start a new reviewed run with --overwrite.")
    if sha256((root / "data/raw/processed.cleveland.data").read_bytes()).hexdigest() != report["dataset_sha256"]:
        raise ValueError("Dataset changed since this report was produced.")
    for package, version in report["versions"].items():
        current = platform.python_version() if package == "python" else importlib.metadata.version(package)
        if current != version:
            raise ValueError(f"Environment changed for {package}; review before starting another run.")
    for relative, expected in report["generated_file_hashes"].items():
        if sha256((root / relative).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Generated output changed: {relative}")
    return report


def run_experiment(project_root: str | Path, *, overwrite: bool = False) -> dict[str, Any]:
    """Select from CV, freeze a training fit, evaluate the holdout once, and save."""
    root = Path(project_root).resolve()
    artifact = root / "models/heart_disease_pipeline.joblib"
    metrics_dir = root / "reports/metrics"
    report_path = metrics_dir / "experiment.json"
    planned_outputs = [artifact, report_path, metrics_dir / "cv_summary.csv", metrics_dir / "cv_folds.csv"]
    planned_outputs.extend(root / "reports/figures" / f"{name}.png" for name in FIGURE_NAMES)
    if not overwrite and any(path.exists() for path in planned_outputs):
        raise FileExistsError("Experiment outputs already exist. Reuse the report or explicitly pass --overwrite for a replay.")
    X, y = load_heart_data(root / "data/raw/processed.cleveland.data")
    X_train, X_test, y_train, y_test = split_data(X, y)
    comparison, folds = compare_models(X_train, y_train)
    selected_name = select_model(comparison)
    LOGGER.info("Selection frozen from training CV: %s", selected_name)
    selected = clone(build_models()[selected_name]).fit(X_train, y_train)
    transformed_names = selected.named_steps["preprocessor"].get_feature_names_out().tolist()
    if len(transformed_names) != 28:
        raise ValueError("The verified Phase 2 training split must produce 28 features.")

    # The only final holdout inference in a run. Figures and metrics reuse these arrays.
    scores = selected.predict_proba(X_test)[:, 1]
    predictions = (scores > 0.5).astype(int)
    evaluation = evaluate_predictions(y_test, predictions, scores)
    evaluation["training_prevalence_baseline_brier"] = float(brier_score_loss(y_test, np.full(len(y_test), y_train.mean())))
    figures = save_figures(comparison, y_test, predictions, scores, selected_name, root / "reports/figures")
    save_pipeline(selected, artifact, overwrite=overwrite)
    artifact_hash = sha256(artifact.read_bytes()).hexdigest()
    restored = load_pipeline(artifact, trusted=True, expected_sha256=artifact_hash)
    # Persistence check uses training rows, never another holdout evaluation.
    np.testing.assert_allclose(restored.predict_proba(X_train.iloc[:10]), selected.predict_proba(X_train.iloc[:10]), rtol=0, atol=0)
    metrics_dir.mkdir(parents=True, exist_ok=True)
    comparison.to_csv(metrics_dir / "cv_summary.csv", index=False)
    folds.to_csv(metrics_dir / "cv_folds.csv", index=False)
    packages = ["pandas", "numpy", "scikit-learn", "scipy", "xgboost", "joblib", "matplotlib"]
    report = {
        "dataset_url": DATA_URL, "dataset_sha256": DATA_SHA256,
        "implementation_sha256": _implementation_hash(), "seed": RANDOM_STATE,
        "train_records": len(X_train), "test_records": len(X_test),
        "train_index_sha256": sha256(X_train.index.to_numpy(dtype="int64").tobytes()).hexdigest(),
        "test_index_sha256": sha256(X_test.index.to_numpy(dtype="int64").tobytes()).hexdigest(),
        "selected_model": selected_name, "selection_rule": SELECTION_RULE,
        "threshold": 0.5, "tuning": "None; fixed modest configurations chosen before test evaluation.",
        "score_semantics": "Uncalibrated experimental score for recorded disease presence; not a real-world risk probability.",
        "evaluation": evaluation, "cv_summary": comparison.to_dict(orient="records"),
        "model_configurations": {name: repr(pipeline.named_steps["classifier"]) for name, pipeline in build_models().items()},
        "raw_features": FEATURES, "transformed_features": transformed_names,
        "versions": {"python": platform.python_version(), **{package: importlib.metadata.version(package) for package in packages}},
        "artifact": artifact.relative_to(root).as_posix(),
        "figures": [path.relative_to(root).as_posix() for path in figures],
        "limitations": [
            "Small historical single-cohort sample; no clinical or external validation.",
            "Earlier EDA examined the full cohort; the holdout is not independent external evidence.",
            "No patient identifiers or chronology for group/time validation; diagnostic test availability needs review.",
            "CV fold SD is not a confidence interval; estimates overlap and do not prove one model is superior.",
            "Calibration is descriptive only; no probability calibration or threshold optimization was fitted.",
        ],
    }
    generated = [artifact, *figures, metrics_dir / "cv_summary.csv", metrics_dir / "cv_folds.csv"]
    report["generated_file_hashes"] = {path.relative_to(root).as_posix(): sha256(path.read_bytes()).hexdigest() for path in generated}
    report_path.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    LOGGER.info("Saved aggregate report and full pipeline; no patient prediction rows exported.")
    return report


def main() -> None:
    """Expose reproducible training as a Windows-friendly module command."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--overwrite", action="store_true", help="Explicitly replay the fixed experiment and replace its generated outputs.")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    try:
        report = run_experiment(args.project_root, overwrite=args.overwrite)
    except (ValueError, FileNotFoundError, FileExistsError) as error:
        parser.exit(1, f"Training stopped: {error}\n")
    print(json.dumps({"selected_model": report["selected_model"], **report["evaluation"]["metrics"]}, indent=2))


if __name__ == "__main__":
    main()
