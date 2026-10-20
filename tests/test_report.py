"""Check cached-run provenance without making more holdout predictions."""

import json
from pathlib import Path

import pytest

from src.train import load_experiment_report


def test_stale_implementation_cache_rejected(tmp_path):
    directory = tmp_path / "reports/metrics"
    directory.mkdir(parents=True)
    (directory / "experiment.json").write_text(json.dumps({"implementation_sha256": "outdated"}), encoding="utf-8")
    with pytest.raises(ValueError, match="Implementation changed"):
        load_experiment_report(tmp_path)


def test_completed_run_files_and_provenance():
    root = Path(__file__).resolve().parents[1]
    if not (root / "reports/metrics/experiment.json").exists():
        pytest.skip("Optional generated-output integration check: run Phase 3 first.")
    report = load_experiment_report(root)
    assert report["train_records"] == 242 and report["test_records"] == 61
    assert len(report["transformed_features"]) == 28
    assert len(report["figures"]) == 6
    assert report["artifact"] in report["generated_file_hashes"]
