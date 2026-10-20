"""Synthetic, non-patient fixtures for unit tests."""

import numpy as np
import pandas as pd
import pytest

from src.data_loader import FEATURES
from src.preprocessing import CATEGORY_CODES


@pytest.fixture
def synthetic_data():
    """Generate balanced named inputs with valid codes and deliberate missing cells."""
    rng = np.random.default_rng(7)
    size = 60
    frame = pd.DataFrame({
        "age": np.linspace(35, 75, size), "trestbps": rng.integers(100, 180, size),
        "chol": rng.integers(140, 320, size), "thalach": rng.integers(95, 195, size),
        "oldpeak": rng.uniform(0, 4, size),
    })
    for column, codes in CATEGORY_CODES.items():
        frame[column] = np.resize(np.array(codes, dtype=float), size)
    target = frame["age"].gt(55).astype("int64").rename("heart_disease")
    frame.loc[0, "ca"] = np.nan
    frame.loc[1, "thal"] = np.nan
    frame.loc[2, "age"] = np.nan
    return frame[FEATURES].astype(float), target
