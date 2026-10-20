"""Load the official Cleveland snapshot and reproduce the Phase 2 split."""

from hashlib import sha256
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

DATA_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data"
DATA_SHA256 = "a74b7efa387bc9d108d7d0115d831fe9b414b29ae7124f331b622b4efa0427c8"
FEATURES = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"]
RANDOM_STATE = 42
TEST_SIZE = 0.20


def prepare_target(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """Separate all 13 predictors and map recorded num=1..4 to presence=1."""
    if list(frame.columns) != FEATURES + ["num"]:
        raise ValueError("Expected the 14 original UCI columns in documented order.")
    if frame["num"].isna().any() or not frame["num"].isin([0, 1, 2, 3, 4]).all():
        raise ValueError("Diagnosis must be non-missing and use codes 0 through 4.")
    X = frame[FEATURES].copy()
    if not all(pd.api.types.is_numeric_dtype(dtype) for dtype in X.dtypes):
        raise ValueError("Features must be numeric; parse '?' as missing first.")
    if np.isinf(X.to_numpy(dtype=float)).any():
        raise ValueError("Infinite feature values are not supported.")
    return X, frame["num"].gt(0).astype("int64").rename("heart_disease")


def load_heart_data(path: str | Path) -> tuple[pd.DataFrame, pd.Series]:
    """Load exactly the local official snapshot; never download or alter it."""
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"Missing UCI input: {path}. Run notebook 01 to obtain it.")
    if sha256(path.read_bytes()).hexdigest() != DATA_SHA256:
        raise ValueError("Dataset fingerprint differs from the verified Phase 2 snapshot.")
    frame = pd.read_csv(path, header=None, names=FEATURES + ["num"], na_values=["?"])
    if frame.shape != (303, 14):
        raise ValueError("Expected 303 Cleveland records and 14 original columns.")
    return prepare_target(frame)


def split_data(X: pd.DataFrame, y: pd.Series) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """Return the same stratified 80/20 row split as notebook 02."""
    if not X.index.is_unique or not X.index.equals(y.index):
        raise ValueError("Features and labels need aligned, unique row indices.")
    return train_test_split(X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y)
