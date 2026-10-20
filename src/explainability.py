"""Frozen-model SHAP explanations in positive-class log-odds, never diagnoses.

Run from the project root: python -m src.explainability
"""

import argparse
from dataclasses import dataclass
from hashlib import sha256
import importlib.metadata
import json
from pathlib import Path
from typing import Any

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.special import expit
import shap
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.utils.validation import check_is_fitted

from .data_loader import DATA_SHA256, FEATURES, load_heart_data, split_data
from .model_utils import load_pipeline, validate_inputs
from .train import load_experiment_report

UNITS = "positive-class log-odds"


def extract_components(pipeline: Pipeline) -> tuple[ColumnTransformer, LogisticRegression]:
    """Validate the saved binary model before exposing its fitted components."""
    if not isinstance(pipeline, Pipeline) or set(pipeline.named_steps) != {"preprocessor", "classifier"}:
        raise ValueError("Expected the saved full preprocessing/classification pipeline.")
    preprocessor, classifier = pipeline.named_steps["preprocessor"], pipeline.named_steps["classifier"]
    if not isinstance(preprocessor, ColumnTransformer) or not isinstance(classifier, LogisticRegression):
        raise ValueError("This explanation engine requires a ColumnTransformer and Logistic Regression.")
    check_is_fitted(preprocessor)
    check_is_fitted(classifier)
    if list(classifier.classes_) != [0, 1] or classifier.coef_.shape[0] != 1:
        raise ValueError("Expected the positive-class binary Logistic Regression representation.")
    return preprocessor, classifier


def load_explanation_model(project_root: str | Path, *, trusted: bool = False) -> Pipeline:
    """Verify Phase 3 provenance and reuse the existing trusted artifact without fitting."""
    root = Path(project_root)
    report = load_experiment_report(root)
    if report["selected_model"] != "Logistic Regression":
        raise ValueError("The frozen selected model is not Logistic Regression.")
    pipeline = load_pipeline(root / report["artifact"], trusted=trusted,
                             expected_sha256=report["generated_file_hashes"][report["artifact"]])
    extract_components(pipeline)
    return pipeline


def feature_mapping(pipeline: Pipeline) -> pd.DataFrame:
    """Align output names to original variables using fitted branch/encoder metadata."""
    preprocessor, classifier = extract_components(pipeline)
    names = preprocessor.get_feature_names_out().tolist()
    if len(names) != classifier.coef_.shape[1] or len(set(names)) != len(names):
        raise ValueError("Transformed names do not match the model coefficient dimension.")
    definitions = {name: (transformer, list(columns)) for name, transformer, columns in preprocessor.transformers_ if name != "remainder"}
    if set(definitions) != {"numeric", "categorical"}:
        raise ValueError("Unsupported preprocessing branches; review the feature mapping.")
    numeric, numeric_columns = definitions["numeric"]
    numeric_names = np.asarray(names)[preprocessor.output_indices_["numeric"]]
    if len(numeric.get_feature_names_out(numeric_columns)) != len(numeric_columns):
        raise ValueError("Numeric preprocessing changed width; explicit mapping is required.")
    mapping: dict[str, dict[str, Any]] = {
        str(name): {"transformed_feature": str(name), "original_feature": column,
                    "representation": "standardized_measurement", "category": None}
        for name, column in zip(numeric_names, numeric_columns, strict=True)
    }
    categorical, categorical_columns = definitions["categorical"]
    if list(categorical.named_steps["imputer"].get_feature_names_out(categorical_columns)) != categorical_columns:
        raise ValueError("Categorical imputation changed width; explicit mapping is required.")
    encoder = categorical.named_steps["encoder"]
    if encoder.min_frequency is not None or encoder.max_categories is not None:
        raise ValueError("Infrequent-category grouping needs a separate mapping implementation.")
    owners = []
    for index, (column, categories) in enumerate(zip(categorical_columns, encoder.categories_, strict=True)):
        dropped = None if encoder.drop_idx_ is None else encoder.drop_idx_[index]
        owners.extend((column, float(category)) for category_index, category in enumerate(categories) if dropped is None or category_index != dropped)
    categorical_names = np.asarray(names)[preprocessor.output_indices_["categorical"]]
    if len(categorical_names) != len(encoder.get_feature_names_out(categorical_columns)):
        raise ValueError("Categorical output names and encoder dimensions disagree.")
    for name, (column, category) in zip(categorical_names, owners, strict=True):
        mapping[str(name)] = {"transformed_feature": str(name), "original_feature": column,
                              "representation": "one_hot_indicator", "category": category}
    if set(mapping) != set(names):
        raise ValueError("Not all transformed features have an original-variable mapping.")
    return pd.DataFrame([mapping[name] for name in names])


def transform_records(pipeline: Pipeline, records: pd.DataFrame) -> pd.DataFrame:
    """Validate original named inputs and apply only the frozen transform method."""
    preprocessor, _ = extract_components(pipeline)
    frame = validate_inputs(records)
    values = np.asarray(preprocessor.transform(frame), dtype=float)
    names = feature_mapping(pipeline)["transformed_feature"].tolist()
    if values.shape != (len(frame), len(names)) or not np.isfinite(values).all():
        raise ValueError("The frozen preprocessor returned invalid values or dimensions.")
    return pd.DataFrame(values, index=frame.index, columns=names)


@dataclass(frozen=True)
class ExplanationEngine:
    """A read-only explanation context; no training or preprocessing fit is performed."""

    pipeline: Pipeline
    explainer: shap.LinearExplainer
    mapping: pd.DataFrame
    background_mean: np.ndarray
    background_records: int
    background_index_sha256: str
    model_state_hash: str


def _index_hash(frame: pd.DataFrame) -> str:
    return sha256(frame.index.to_numpy(dtype="int64").tobytes()).hexdigest()


def build_explainer(pipeline: Pipeline, training_background: pd.DataFrame) -> ExplanationEngine:
    """Use every supplied training row with Independent masking; never fit the model."""
    before = joblib.hash(pipeline)
    _, classifier = extract_components(pipeline)
    background = transform_records(pipeline, training_background)
    masker = shap.maskers.Independent(background, max_samples=len(background))
    explainer = shap.LinearExplainer(classifier, masker, feature_names=background.columns.tolist())
    if joblib.hash(pipeline) != before:
        raise RuntimeError("Explanation construction modified the fitted pipeline.")
    return ExplanationEngine(pipeline, explainer, feature_mapping(pipeline), background.to_numpy().mean(axis=0),
                             len(background), _index_hash(training_background), before)


def explain_global(engine: ExplanationEngine, records: pd.DataFrame) -> shap.Explanation:
    """Explain rows against the fixed training background in positive-class log-odds."""
    if joblib.hash(engine.pipeline) != engine.model_state_hash:
        raise ValueError("The pipeline changed after explainer construction.")
    transformed = transform_records(engine.pipeline, records)
    explanation = engine.explainer(transformed)
    expected_shape = transformed.shape
    if np.asarray(explanation.values).shape != expected_shape or not np.isfinite(explanation.values).all():
        raise ValueError("SHAP returned invalid values or dimensions.")
    if not np.isfinite(explanation.base_values).all():
        raise ValueError("SHAP baseline is not finite.")
    if list(explanation.feature_names) != transformed.columns.tolist():
        raise ValueError("SHAP feature names do not match the fitted feature order.")
    if joblib.hash(engine.pipeline) != engine.model_state_hash:
        raise RuntimeError("SHAP calculation modified the fitted pipeline.")
    return explanation


def explain_individual(engine: ExplanationEngine, record: pd.DataFrame) -> shap.Explanation:
    """Return a single-row explanation suitable for a waterfall plot."""
    frame = validate_inputs(record)
    if len(frame) != 1:
        raise ValueError("An individual explanation requires exactly one record.")
    return explain_global(engine, frame)[0]


def validate_reconstruction(engine: ExplanationEngine, records: pd.DataFrame,
                            explanation: shap.Explanation) -> dict[str, float]:
    """Check log-odds additivity, analytic linear contributions, and sigmoid scores."""
    transformed = transform_records(engine.pipeline, records)
    if np.asarray(explanation.values).shape != transformed.shape or list(explanation.feature_names) != transformed.columns.tolist():
        raise ValueError("Explanation dimensions or feature names are misaligned.")
    np.testing.assert_allclose(explanation.data, transformed.to_numpy(), rtol=0, atol=1e-12)
    _, classifier = extract_components(engine.pipeline)
    baseline = np.asarray(explanation.base_values)
    expected_baseline = float(classifier.intercept_[0] + classifier.coef_[0] @ engine.background_mean)
    np.testing.assert_allclose(baseline, expected_baseline, rtol=0, atol=1e-10)
    log_odds = classifier.decision_function(transformed.to_numpy())
    reconstructed = baseline + explanation.values.sum(axis=1)
    scores = engine.pipeline.predict_proba(validate_inputs(records))[:, 1]
    analytic = (transformed.to_numpy() - engine.background_mean) * classifier.coef_[0]
    np.testing.assert_allclose(reconstructed, log_odds, rtol=0, atol=1e-10)
    np.testing.assert_allclose(expit(reconstructed), scores, rtol=0, atol=1e-12)
    np.testing.assert_allclose(explanation.values, analytic, rtol=0, atol=1e-10)
    return {"max_log_odds_error": float(np.max(np.abs(reconstructed - log_odds))),
            "max_score_error": float(np.max(np.abs(expit(reconstructed) - scores))),
            "max_analytic_contribution_error": float(np.max(np.abs(explanation.values - analytic)))}


def group_contributions(explanation: shap.Explanation, mapping: pd.DataFrame) -> pd.DataFrame:
    """Sum signed encoded contributions per record, preserving additive totals."""
    if list(explanation.feature_names) != mapping["transformed_feature"].tolist():
        raise ValueError("Feature mapping and explanation order disagree.")
    if set(mapping["original_feature"]) != set(FEATURES):
        raise ValueError("Mapping must cover all original features.")
    values = np.asarray(explanation.values)
    if values.ndim != 2 or values.shape[1] != len(mapping) or not np.isfinite(values).all():
        raise ValueError("Expected finite record-by-feature SHAP values.")
    owners = mapping["original_feature"].to_numpy()
    grouped = pd.DataFrame({column: values[:, owners == column].sum(axis=1) for column in FEATURES})
    np.testing.assert_allclose(grouped.sum(axis=1), values.sum(axis=1), rtol=0, atol=1e-10)
    return grouped


def global_importance(explanation: shap.Explanation, mapping: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return encoded importance and both magnitude-sum and net-group definitions."""
    grouped_values = group_contributions(explanation, mapping)
    transformed = mapping.copy()
    transformed["mean_absolute_shap"] = np.abs(explanation.values).mean(axis=0)
    transformed["mean_signed_shap"] = explanation.values.mean(axis=0)
    magnitudes = transformed.groupby("original_feature", sort=False)["mean_absolute_shap"].sum()
    grouped = pd.DataFrame({"original_feature": FEATURES,
                            "sum_mean_absolute_shap": [float(magnitudes[column]) for column in FEATURES],
                            "mean_absolute_net_shap": [float(grouped_values[column].abs().mean()) for column in FEATURES]})
    return (transformed.sort_values("mean_absolute_shap", ascending=False, kind="stable").reset_index(drop=True),
            grouped.sort_values("sum_mean_absolute_shap", ascending=False, kind="stable").reset_index(drop=True))


def select_examples(scores: np.ndarray, recorded_labels: pd.Series) -> dict[str, int]:
    """Choose first positive/negative and first distinct error, in fixed split order."""
    scores = np.asarray(scores)
    if (scores.ndim != 1 or len(scores) != len(recorded_labels) or not np.isfinite(scores).all()
            or ((scores < 0) | (scores > 1)).any()):
        raise ValueError("Aligned finite scores and recorded labels are required.")
    predicted = (scores > 0.5).astype(int)
    examples = {}
    for name, mask in [("positive", predicted == 1), ("negative", predicted == 0)]:
        positions = np.flatnonzero(mask)
        if len(positions):
            examples[name] = int(positions[0])
    mistakes = np.flatnonzero(predicted != np.asarray(recorded_labels))
    unused = [int(position) for position in mistakes if position not in examples.values()]
    if len(mistakes):
        examples["misclassified"] = unused[0] if unused else int(mistakes[0])
    return examples


def individual_summary(engine: ExplanationEngine, explanation: shap.Explanation, position: int,
                       score: float, recorded_label: int) -> dict[str, Any]:
    """Produce a dashboard-ready summary without identifiers or the raw feature profile."""
    values = np.asarray(explanation.values[position])
    strongest = []
    for label, mask, sign in [("positive", values > 0, -1), ("negative", values < 0, 1)]:
        candidates = np.flatnonzero(mask)
        order = candidates[np.argsort(sign * values[candidates], kind="stable")][:3]
        strongest.append((label, [{"feature": explanation.feature_names[index],
                                  "contribution_log_odds": float(values[index])} for index in order]))
    return {"holdout_position": position, "predicted_class": int(score > 0.5),
            "recorded_class": int(recorded_label), "model_score": float(score),
            "score_semantics": "uncalibrated experimental score, not clinical disease risk",
            "baseline_log_odds": float(np.asarray(explanation.base_values)[position]),
            "sum_shap_log_odds": float(values.sum()),
            "reconstructed_log_odds": float(np.asarray(explanation.base_values)[position] + values.sum()),
            "strongest_contributions": dict(strongest)}


def save_explanation_figures(explanation: shap.Explanation, transformed: pd.DataFrame,
                             grouped: pd.DataFrame, examples: dict[str, int], directory: str | Path) -> list[Path]:
    """Save beeswarm, encoded/grouped bars, and local log-odds waterfalls."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    paths = []

    def save(fig: plt.Figure, name: str) -> None:
        path = directory / f"{name}.png"
        fig.savefig(path, dpi=200, bbox_inches="tight")
        plt.close(fig)
        paths.append(path)

    # Fix plot jitter without leaving the caller's global NumPy state changed.
    random_state = np.random.get_state()
    try:
        np.random.seed(42)
        shap.plots.beeswarm(explanation, max_display=15, show=False, plot_size=(12, 8),
                            color_bar_label="Transformed value (scaled measurement or 0/1)")
        fig = plt.gcf()
        plt.gca().set_xlabel("SHAP contribution to positive-class log-odds")
        plt.gca().set_title(f"Frozen Logistic Regression: {len(explanation.values)} explained records", pad=18)
        save(fig, "shap_beeswarm")
    finally:
        np.random.set_state(random_state)

    for table, feature_column, value_column, title, filename in [
        (transformed.head(15), "transformed_feature", "mean_absolute_shap", "Transformed-feature importance", "global_mean_absolute_shap"),
        (grouped, "original_feature", "sum_mean_absolute_shap", "Original-variable importance: sum of encoded magnitudes", "grouped_original_importance"),
    ]:
        fig, ax = plt.subplots(figsize=(11, 8))
        shown = table.iloc[::-1]
        ax.barh(shown[feature_column], shown[value_column], color="#287D8E")
        ax.set(title=title, xlabel="Mean absolute contribution (log-odds)", ylabel="")
        ax.grid(axis="x", alpha=0.2)
        fig.tight_layout()
        save(fig, filename)
    for name, position in examples.items():
        shap.plots.waterfall(explanation[position], max_display=12, show=False)
        fig = plt.gcf()
        fig.set_size_inches(13, 8)
        plt.gca().set_xlabel("Model output and additive SHAP contributions (log-odds)")
        fig.suptitle(f"{name.capitalize()} example: holdout position {position} (zero-based)", y=1.02)
        save(fig, f"waterfall_{name}")
    return paths


def _code_hash() -> str:
    return sha256(Path(__file__).read_bytes()).hexdigest()


def load_explainability_report(project_root: str | Path) -> dict[str, Any]:
    """Reject stale XAI outputs rather than silently reusing explanations of another model."""
    root = Path(project_root)
    report = json.loads((root / "reports/metrics/explainability.json").read_text(encoding="utf-8"))
    if report["explanation_code_sha256"] != _code_hash():
        raise ValueError("Explainability code changed; review and explicitly regenerate XAI outputs.")
    for relative, expected in report["protected_source_hashes"].items():
        if sha256((root / relative).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Frozen source changed: {relative}")
    for package, version in report["versions"].items():
        if importlib.metadata.version(package) != version:
            raise ValueError(f"Explanation environment changed for {package}.")
    for relative, expected in report["figure_hashes"].items():
        if sha256((root / relative).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Explanation figure changed: {relative}")
    return report


def run_explainability(project_root: str | Path, *, overwrite: bool = False) -> dict[str, Any]:
    """Explain the fixed holdout with training-only background; never retrain or save a model."""
    root = Path(project_root).resolve()
    report_path = root / "reports/metrics/explainability.json"
    if report_path.exists() and not overwrite:
        return load_explainability_report(root)
    figure_dir = root / "reports/figures/explainability"
    planned_figures = [figure_dir / f"{name}.png" for name in ["shap_beeswarm", "global_mean_absolute_shap", "grouped_original_importance", "waterfall_positive", "waterfall_negative", "waterfall_misclassified"]]
    if not overwrite and any(path.exists() for path in planned_figures):
        raise FileExistsError("XAI figures already exist without a complete report; review before --overwrite.")
    protected = ["models/heart_disease_pipeline.joblib", "reports/metrics/experiment.json", "data/raw/processed.cleveland.data"]
    protected_hashes = {relative: sha256((root / relative).read_bytes()).hexdigest() for relative in protected}
    training_report = load_experiment_report(root)
    pipeline = load_explanation_model(root, trusted=True)
    X, y = load_heart_data(root / "data/raw/processed.cleveland.data")
    X_train, X_test, _, y_test = split_data(X, y)
    if _index_hash(X_train) != training_report["train_index_sha256"] or _index_hash(X_test) != training_report["test_index_sha256"]:
        raise ValueError("The explanation split differs from the frozen training experiment.")
    engine = build_explainer(pipeline, X_train)
    explanation = explain_global(engine, X_test)
    diagnostics = validate_reconstruction(engine, X_test, explanation)
    transformed, grouped = global_importance(explanation, engine.mapping)
    scores = pipeline.predict_proba(validate_inputs(X_test))[:, 1]
    examples = select_examples(scores, y_test)
    if not {"positive", "negative"}.issubset(examples):
        raise ValueError("The evaluation set does not contain both predicted classes.")
    paths = save_explanation_figures(explanation, transformed, grouped, examples, figure_dir)
    _, classifier = extract_components(pipeline)
    report = {
        "method": "shap.LinearExplainer with Independent masker; interventional/independence assumption in transformed space",
        "units": UNITS, "explained_records": len(X_test), "transformed_feature_count": len(engine.mapping),
        "background_records": engine.background_records, "background_selection": "All 242 training records, no subsampling; max_samples set explicitly to background size.",
        "background_index_sha256": engine.background_index_sha256,
        "model_intercept_log_odds": float(classifier.intercept_[0]),
        "baseline_log_odds": float(np.asarray(explanation.base_values)[0]),
        "sigmoid_of_baseline": float(expit(np.asarray(explanation.base_values)[0])),
        "baseline_note": "Mean model log-odds on the training background; sigmoid of that mean is not the mean predicted score.",
        "diagnostics": diagnostics, "global_transformed_importance": transformed.where(transformed.notna(), None).to_dict(orient="records"),
        "grouped_original_importance": grouped.to_dict(orient="records"),
        "grouping_definitions": {"sum_mean_absolute_shap": "Sum of per-encoded-feature mean absolute contributions, without cancellation.",
                                  "mean_absolute_net_shap": "Mean absolute value after summing signed contributions per record; cancellation is possible."},
        "examples": {name: individual_summary(engine, explanation, position, float(scores[position]), int(y_test.iloc[position])) for name, position in examples.items()},
        "feature_mapping": engine.mapping.astype(object).where(engine.mapping.notna(), None).to_dict(orient="records"),
        "example_selection": "First predicted-positive and predicted-negative zero-based holdout positions; first misclassification not already selected if available, otherwise first misclassification. Labels identify an educational error only, never fit or revise the model.",
        "protected_source_hashes": protected_hashes, "explanation_code_sha256": _code_hash(),
        "versions": {name: importlib.metadata.version(name) for name in ["shap", "numpy", "pandas", "scikit-learn", "matplotlib", "joblib", "scipy"]},
        "figures": [path.relative_to(root).as_posix() for path in paths],
        "figure_hashes": {path.relative_to(root).as_posix(): sha256(path.read_bytes()).hexdigest() for path in paths},
        "limitations": ["Explains frozen model associations, not causation or clinical relevance.",
                        "Independent masking ignores correlation and one-hot exclusivity; allocations depend on representation and background.",
                        "Absolute-magnitude grouped importance is not a new group-coalition SHAP computation.",
                        "Small historical cohort and prior full-cohort EDA; no external validation or clinical calibration."],
    }
    # Categories absent on measurement rows must serialize as JSON null, not NaN.
    for row in report["global_transformed_importance"]:
        if row["representation"] == "standardized_measurement":
            row["category"] = None
    if joblib.hash(pipeline) != engine.model_state_hash:
        raise RuntimeError("Explanation workflow modified model state.")
    if any(sha256((root / relative).read_bytes()).hexdigest() != digest for relative, digest in protected_hashes.items()):
        raise RuntimeError("A frozen model, source dataset, or Phase 3 report changed.")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    return report


def main() -> None:
    """Expose XAI generation as a module command without invoking training."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--overwrite", action="store_true", help="Regenerate only Phase 4 plots and report, keeping the model frozen.")
    args = parser.parse_args()
    try:
        report = run_explainability(args.project_root, overwrite=args.overwrite)
    except (ValueError, FileNotFoundError, FileExistsError) as error:
        parser.exit(1, f"Explainability stopped: {error}\n")
    print(json.dumps({"explained_records": report["explained_records"], "background_records": report["background_records"], **report["diagnostics"]}, indent=2))


if __name__ == "__main__":
    main()
