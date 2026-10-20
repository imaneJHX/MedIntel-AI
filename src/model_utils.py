"""Persist trusted full pipelines and validate named research prediction inputs."""

from collections.abc import Mapping, Sequence
from hashlib import sha256
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.utils.validation import check_is_fitted

from .data_loader import FEATURES
from .preprocessing import CATEGORY_CODES, NUMERIC_FEATURES


def save_pipeline(pipeline: Pipeline, path: str | Path, *, overwrite: bool = False) -> Path:
    """Atomically write a fitted full pipeline; preserve existing artifacts by default."""
    check_is_fitted(pipeline.named_steps["classifier"])
    path = Path(path)
    if path.exists() and not overwrite:
        raise FileExistsError(f"Artifact already exists: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    try:
        joblib.dump(pipeline, temporary, compress=3)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return path


def load_pipeline(path: str | Path, *, trusted: bool = False, expected_sha256: str | None = None) -> Pipeline:
    """Load only an explicitly trusted local artifact; Joblib can execute code."""
    if not trusted:
        raise ValueError("Only load artifacts whose origin you trust; pass trusted=True explicitly.")
    path = Path(path)
    if expected_sha256 is not None and sha256(path.read_bytes()).hexdigest() != expected_sha256:
        raise ValueError("Artifact fingerprint mismatch.")
    pipeline = joblib.load(path)
    if not isinstance(pipeline, Pipeline) or set(pipeline.named_steps) != {"preprocessor", "classifier"}:
        raise ValueError("Expected a full MedIntel preprocessing/classification pipeline.")
    check_is_fitted(pipeline.named_steps["classifier"])
    if list(pipeline.feature_names_in_) != FEATURES or list(pipeline.classes_) != [0, 1]:
        raise ValueError("Unexpected model feature schema or target classes.")
    return pipeline


def validate_inputs(records: pd.DataFrame | Mapping[str, Any] | Sequence[Mapping[str, Any]]) -> pd.DataFrame:
    """Require all named fields; allow null measurements for learned imputation."""
    if isinstance(records, pd.DataFrame):
        frame = records.copy()
    elif isinstance(records, Mapping):
        frame = pd.DataFrame([records])
    elif isinstance(records, Sequence) and not isinstance(records, (str, bytes)):
        if not records or not all(isinstance(row, Mapping) for row in records):
            raise ValueError("Provide a non-empty sequence of named records.")
        if any(set(row) != set(FEATURES) for row in records):
            raise ValueError("Every record must contain exactly the 13 feature names.")
        frame = pd.DataFrame(records)
    else:
        raise ValueError("Provide a dataframe, named record, or sequence of named records.")
    if frame.empty or not frame.columns.is_unique:
        raise ValueError("Inputs must contain records and unique column names.")
    if set(frame.columns) != set(FEATURES):
        missing = sorted(set(FEATURES) - set(frame.columns))
        extra = sorted(str(name) for name in set(frame.columns) - set(FEATURES))
        raise ValueError(f"Feature names do not match. Missing: {missing}; unexpected: {extra}")
    for column in FEATURES:
        if frame[column].dropna().map(lambda value: isinstance(value, (bool, np.bool_))).any():
            raise ValueError(f"{column} must contain numeric measurements or codes, not booleans.")
        try:
            frame[column] = pd.to_numeric(frame[column], errors="raise").astype(float)
        except (ValueError, TypeError) as error:
            raise ValueError(f"{column} must contain numeric values or null.") from error
    frame = frame[FEATURES]
    if np.isinf(frame.to_numpy()).any() or frame.isna().all(axis=1).any():
        raise ValueError("Infinite values and entirely empty records are not supported.")
    for column, codes in CATEGORY_CODES.items():
        if not frame[column].dropna().isin(codes).all():
            raise ValueError(f"{column} must use documented UCI codes {codes} or null.")
    for column in NUMERIC_FEATURES:
        observed = frame[column].dropna()
        if (observed < 0).any() or (column != "oldpeak" and (observed == 0).any()):
            raise ValueError(f"{column} contains invalid non-positive measurements.")
    if (frame["age"].dropna() > 120).any():
        raise ValueError("Age must be at most 120 years.")
    return frame


def predict_records(pipeline: Pipeline, records: pd.DataFrame | Mapping[str, Any] | Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Return experimental classes and uncalibrated scores, never clinical risks."""
    frame = validate_inputs(records)
    scores = pipeline.predict_proba(frame)[:, 1]
    if not np.isfinite(scores).all() or ((scores < 0) | (scores > 1)).any():
        raise ValueError("The pipeline returned invalid model scores.")
    return [
        {"predicted_class": int(score > 0.5), "model_score": float(score),
         "score_label": "uncalibrated experimental model score", "threshold": 0.5}
        for score in scores
    ]
