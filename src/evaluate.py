"""Binary research metrics, descriptive uncertainty, and exportable figures."""

from pathlib import Path
from statistics import NormalDist
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.metrics import (
    accuracy_score, brier_score_loss, classification_report, confusion_matrix,
    f1_score, precision_recall_curve, precision_score, recall_score, roc_auc_score, roc_curve,
)

FIGURE_NAMES = ["cv_comparison", "confusion_matrix", "roc_curve", "precision_recall_curve", "score_distribution", "calibration_curve"]


def wilson_interval(successes: int, total: int) -> list[float]:
    """Return a descriptive 95% Wilson binomial interval, without SciPy state."""
    if total == 0:
        return [0.0, 1.0]
    z = NormalDist().inv_cdf(0.975)
    p = successes / total
    denominator = 1 + z * z / total
    center = (p + z * z / (2 * total)) / denominator
    half = z * np.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator
    return [float(max(0, center - half)), float(min(1, center + half))]


def evaluate_predictions(y_true: pd.Series | np.ndarray, predictions: np.ndarray, scores: np.ndarray) -> dict[str, Any]:
    """Calculate final metrics from one frozen set of holdout predictions."""
    truth = np.asarray(y_true)
    predictions = np.asarray(predictions)
    scores = np.asarray(scores, dtype=float)
    if truth.ndim != 1 or predictions.shape != truth.shape or scores.shape != truth.shape:
        raise ValueError("Labels, predictions, and scores must be aligned one-dimensional arrays.")
    if set(np.unique(truth)) != {0, 1} or not np.isin(predictions, [0, 1]).all():
        raise ValueError("Both binary true classes and binary predictions are required.")
    if not np.isfinite(scores).all() or ((scores < 0) | (scores > 1)).any():
        raise ValueError("Model scores must be finite values between zero and one.")
    tn, fp, fn, tp = (int(value) for value in confusion_matrix(truth, predictions, labels=[0, 1]).ravel())
    metrics = {
        "accuracy": float(accuracy_score(truth, predictions)),
        "precision": float(precision_score(truth, predictions, zero_division=0)),
        "recall": float(recall_score(truth, predictions, zero_division=0)),
        "f1": float(f1_score(truth, predictions, zero_division=0)),
        "roc_auc": float(roc_auc_score(truth, scores)),
        "sensitivity": tp / (tp + fn),
        "specificity": tn / (tn + fp),
        "brier_score": float(brier_score_loss(truth, scores)),
    }
    intervals = {
        "accuracy": wilson_interval(tp + tn, len(truth)),
        "precision": wilson_interval(tp, tp + fp),
        "sensitivity": wilson_interval(tp, tp + fn),
        "specificity": wilson_interval(tn, tn + fp),
    }
    # Stratification keeps both classes in every resample. No estimator is refitted.
    rng = np.random.default_rng(42)
    absent, present = np.flatnonzero(truth == 0), np.flatnonzero(truth == 1)
    auc_samples = []
    for _ in range(500):
        positions = np.concatenate([rng.choice(absent, len(absent)), rng.choice(present, len(present))])
        auc_samples.append(roc_auc_score(truth[positions], scores[positions]))
    intervals["roc_auc"] = np.quantile(auc_samples, [0.025, 0.975]).tolist()
    return {
        "metrics": metrics,
        "confusion_matrix": [[tn, fp], [fn, tp]],
        "classification_report": classification_report(
            truth, predictions, labels=[0, 1], target_names=["recorded_absent", "recorded_present"],
            output_dict=True, zero_division=0,
        ),
        "intervals_95": intervals,
        "uncertainty_method": "Wilson binomial intervals; ROC-AUC: 500 stratified percentile bootstrap resamples, seed 42. Descriptive, conditional on this fitted model and small sample; excludes selection and dataset-shift uncertainty.",
    }


def save_figures(comparison: pd.DataFrame, y_true: pd.Series, predictions: np.ndarray, scores: np.ndarray,
                 selected_name: str, directory: str | Path) -> list[Path]:
    """Export six aggregate figures without exporting patient-level prediction rows."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False})

    def save(fig: plt.Figure, name: str) -> None:
        fig.tight_layout()
        path = directory / f"{name}.png"
        fig.savefig(path, dpi=160, bbox_inches="tight")
        plt.close(fig)
        paths.append(path)

    fig, ax = plt.subplots(figsize=(11, 5))
    positions = np.arange(len(comparison))
    metrics = ["accuracy", "precision", "recall", "f1", "roc_auc"]
    for offset, (metric, color) in enumerate(zip(metrics, ["#287D8E", "#C88739", "#94569C", "#4D8755", "#4571A6"])):
        ax.errorbar(positions + (offset - 2) * 0.13, comparison[f"{metric}_mean"],
                    yerr=comparison[f"{metric}_std"], fmt="o", capsize=4, color=color, label=metric.replace("_", " "))
    ax.set(xticks=positions, xticklabels=comparison["model"], ylabel="Mean score +/- sample SD",
           ylim=(0, 1.08), title="Training-only stratified five-fold comparison")
    ax.legend(ncol=5, loc="lower center")
    ax.text(0.01, 0.02, "Fold SD describes variability; it is not a confidence interval.", transform=ax.transAxes, fontsize=9)
    save(fig, "cv_comparison")

    matrix = confusion_matrix(y_true, predictions, labels=[0, 1])
    fig, ax = plt.subplots(figsize=(6, 5))
    image = ax.imshow(matrix, cmap="Blues", vmin=0)
    for (row, column), value in np.ndenumerate(matrix):
        ax.text(column, row, str(value), ha="center", va="center", fontsize=20,
                color="white" if value > matrix.max() / 2 else "black")
    ax.set(xticks=[0, 1], yticks=[0, 1], xticklabels=["Absent", "Present"], yticklabels=["Absent", "Present"],
           xlabel="Predicted class", ylabel="Recorded class", title=f"Holdout confusion matrix: {selected_name}")
    fig.colorbar(image, ax=ax, label="Records")
    save(fig, "confusion_matrix")

    fpr, tpr, _ = roc_curve(y_true, scores)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(fpr, tpr, color="#287D8E", label=f"ROC-AUC = {roc_auc_score(y_true, scores):.3f}")
    ax.plot([0, 1], [0, 1], "--", color="gray", label="Chance ranking")
    ax.set(xlabel="False positive rate", ylabel="Sensitivity (recall)", title="Holdout ROC curve", xlim=(0, 1), ylim=(0, 1.03))
    ax.legend()
    save(fig, "roc_curve")

    precision, recall, _ = precision_recall_curve(y_true, scores)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.step(recall, precision, where="post", color="#287D8E", label=selected_name)
    ax.axhline(np.mean(y_true), linestyle="--", color="gray", label="Holdout presence fraction")
    ax.set(xlabel="Recall", ylabel="Precision", title="Holdout precision-recall curve", xlim=(0, 1), ylim=(0, 1.03))
    ax.legend()
    save(fig, "precision_recall_curve")

    fig, ax = plt.subplots(figsize=(8, 5))
    for code, label, color in [(0, "Recorded absent", "#287D8E"), (1, "Recorded present", "#C88739")]:
        ax.hist(scores[np.asarray(y_true) == code], bins=np.linspace(0, 1, 11), alpha=0.65, color=color, label=label)
    ax.axvline(0.5, linestyle="--", color="black", label="Fixed threshold 0.5")
    ax.set(xlabel="Uncalibrated model score (not real-world disease risk)", ylabel="Records", title="Holdout score distributions")
    ax.legend()
    save(fig, "score_distribution")

    fraction, mean_score = calibration_curve(y_true, scores, n_bins=5, strategy="uniform")
    bin_ids = np.searchsorted(np.linspace(0, 1, 6)[1:-1], scores)
    counts = np.bincount(bin_ids, minlength=5)
    successes = np.bincount(bin_ids, weights=np.asarray(y_true), minlength=5)
    intervals = np.array([wilson_interval(int(successes[i]), int(counts[i])) for i in range(5) if counts[i]])
    errors = np.vstack([np.maximum(0, fraction - intervals[:, 0]), np.maximum(0, intervals[:, 1] - fraction)])
    fig, ax = plt.subplots(figsize=(7, 6))
    ax.plot([0, 1], [0, 1], "--", color="gray", label="Ideal calibration")
    ax.errorbar(mean_score, fraction, yerr=errors, fmt="o-", capsize=4, color="#287D8E", label="Uncalibrated model; 95% Wilson intervals")
    for x, y, count in zip(mean_score, fraction, counts[counts > 0]):
        ax.annotate(f"n={count}", (x, y), xytext=(5, 7), textcoords="offset points", fontsize=9)
    ax.set(xlabel="Mean uncalibrated model score", ylabel="Recorded presence fraction",
           title=f"Calibration: only {len(y_true)} holdout records\nSmall bins imply substantial uncertainty", xlim=(0, 1), ylim=(-0.04, 1.08))
    ax.legend(fontsize=9, loc="lower right")
    save(fig, "calibration_curve")
    return paths
