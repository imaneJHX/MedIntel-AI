# Phase 3: verified heart disease model experiment

This educational research experiment classifies **recorded disease presence** in
the official UCI processed Cleveland cohort. It does not diagnose patients,
predict future onset, or establish clinical reliability. Phase 4 is not implemented.

## Preserved source and preprocessing

The source is the [official UCI file](https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data),
with SHA-256 `a74b7efa387bc9d108d7d0115d831fe9b414b29ae7124f331b622b4efa0427c8`.
It has 303 records, 13 features, one original diagnosis field, and six missing
values. Original `num=0` becomes 0; `num=1-4` becomes 1. Both target representations
are excluded from the predictors.

The Phase 2 split is preserved: seed 42, stratified 80/20, with 242 training and
61 test records. Training labels contain 131 recorded absences and 111 presences;
the test set contains 33 absences and 28 presences. Both previous notebooks and
their outputs, and the raw data, were verified byte-for-byte unchanged.

Five measurement features use median imputation followed by standardization.
Eight coded/discrete fields use most-frequent imputation and full one-hot encoding.
The full training fit produces 28 features. Every cross-validation fold fits a
fresh complete preprocessing/classifier pipeline on that fold's training rows;
category widths may differ if a fold has an unseen category. Unknown categories
are handled without changing the fitted schema.

## Fixed experiment and model explanations

Logistic Regression is a regularized linear log-odds classifier. Its sigmoid score
supports binary classification; coefficient signs represent conditional associations
in the transformed representation, not causal effects. L2 regularization limits
coefficient magnitude; `C=1` controls inverse regularization strength. We use
`max_iter=2000`, the `lbfgs` solver, and balanced class weights computed within each fit.

Random Forest averages 200 randomized decision trees. Each tree partitions the
features through rules, using a bootstrap sample and random feature subsets.
Combining trees reduces single-tree instability and can learn nonlinear interactions.
Depth 4 and at least 3 samples per leaf constrain flexibility. Balanced class weights
are computed within fits. The ensemble is less directly interpretable than the linear
baseline and can still overfit.

XGBoost builds 150 shallow trees sequentially to reduce the current classification
loss through gradient-based updates. Depth 2, learning rate 0.05, minimum child
weight 3, L2 leaf-weight penalty 2, and 90% row/feature sampling limit complexity.
Histogram splitting is efficient for this small structured dataset. Boosting can
capture interactions but also fit noise. The available package index supplied
XGBoost 3.4.1; that is the installed and pinned version.

All candidates use seed 42 and one worker. Scaling remains in the shared Phase 2
feature design even though the tree models do not require it. No hyperparameter
search, early stopping, threshold optimization, or post-hoc calibrator is used.

The selection rule was declared before evaluation: among models with mean CV
precision at least 0.60, maximize mean positive-class recall; break ties with F1,
then ROC-AUC, then the original candidate order. If no candidate passes the guardrail,
maximize F1, then recall and ROC-AUC. This is an explicit research trade-off, not
a clinical acceptance threshold. The decision threshold remains 0.5.

## Actual training-only cross-validation results

Five shuffled stratified folds use the same split seed for all models. Entries are
**mean +/- sample standard deviation** across validation folds. Fold SD is not a
confidence interval; overlap does not establish superiority or equivalence.

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
| --- | --- | --- | --- | --- | --- |
| Logistic Regression | 0.855 +/- 0.027 | 0.873 +/- 0.069 | 0.810 +/- 0.069 | 0.837 +/- 0.029 | 0.902 +/- 0.017 |
| Random Forest | 0.806 +/- 0.033 | 0.802 +/- 0.079 | 0.783 +/- 0.089 | 0.786 +/- 0.034 | 0.900 +/- 0.033 |
| XGBoost | 0.793 +/- 0.030 | 0.780 +/- 0.058 | 0.774 +/- 0.073 | 0.774 +/- 0.034 | 0.884 +/- 0.026 |

All candidates pass the precision guardrail. **Logistic Regression is selected**
because its mean recall is highest. It also has the highest observed means under
the other requested priorities in this fixed comparison, while offering a compact
baseline. This result applies to these configurations and folds; it does not show
that Logistic Regression is universally better or that the alternatives were fully tuned.

| Model | Mean training accuracy | Mean validation accuracy | Training-minus-validation gap | Mean validation Brier score |
| --- | --- | --- | --- | --- |
| Logistic Regression | 0.8657 | 0.8552 | 0.0105 | 0.1215 |
| Random Forest | 0.8864 | 0.8055 | 0.0809 | 0.1327 |
| XGBoost | 0.8926 | 0.7934 | 0.0992 | 0.1353 |

The larger ensemble gaps suggest more optimism/overfitting than the baseline in
this experiment. The gaps are descriptive; training performance is optimistic by
construction. The lower Brier score for the baseline also supports reporting it
as the strongest observed fixed candidate, without claiming calibrated clinical risk.

## Actual final holdout results

Selection was frozen from CV before fitting the selected full pipeline on all
training rows. Only that selected pipeline generated holdout scores. All final
metrics and figures reuse those same scores; no test-based revision was made.

| Metric | Observed value |
| --- | --- |
| Accuracy | 0.8689 |
| Precision, recorded-present class | 0.8125 |
| Recall / sensitivity | 0.9286 |
| F1 | 0.8667 |
| ROC-AUC | 0.9665 |
| Specificity | 0.8182 |
| Brier score, lower is better | 0.0832 |
| Constant-score Brier baseline using training prevalence | 0.2483 |

Rows below are recorded status; columns are predicted classes.

| | Predicted absent | Predicted present |
| --- | --- | --- |
| Recorded absent | 27 true negatives | 6 false positives |
| Recorded present | 2 false negatives | 26 true positives |

Thus 2 of 28 recorded-positive test records were missed and 6 of 33 recorded-negative
records were assigned class 1. Those errors remain material even when summary
metrics look favorable. The higher holdout recall and AUC than CV can reflect
sampling variation; they are not a reason to revise the selected model.

| Quantity | Descriptive 95% interval |
| --- | --- |
| Accuracy | 0.7620-0.9320 |
| Precision | 0.6469-0.9111 |
| Sensitivity | 0.7735-0.9802 |
| Specificity | 0.6561-0.9139 |
| ROC-AUC | 0.9237-0.9968 |

Binomial quantities use Wilson intervals. AUC uses 500 stratified bootstrap
resamples of the fixed test scores, seed 42, with no refitting. These intervals
are conditional on this model and sample, excluding selection and dataset-shift
uncertainty. A small positive count limits sensitivity precision. No calibrated
real-world probability interpretation is justified by the Brier point estimate.

## Six exported visualizations

| Local path | Interpretation |
| --- | --- |
| `reports/figures/cv_comparison.png` | Mean classification metrics with fold SD; compare research priorities, not statistical significance. |
| `reports/figures/confusion_matrix.png` | Count the two missed positives and six false positives at the fixed threshold. |
| `reports/figures/roc_curve.png` | Rank discrimination across thresholds; AUC does not measure calibration. |
| `reports/figures/precision_recall_curve.png` | Precision/recall trade-offs relative to the sample's positive fraction. |
| `reports/figures/score_distribution.png` | Score overlap between recorded classes; these are uncalibrated model outputs, not disease probabilities. |
| `reports/figures/calibration_curve.png` | Five fixed-width bins with counts and Wilson intervals; bins are small and uncertainty is substantial. |

Calibration is assessed descriptively, not fitted on the test set. The notebook
embeds all six figures and explains them. Generated files are ignored in Git;
their full-precision results remain reviewable in the executed notebook.

## Important files and functions

| File | What it provides |
| --- | --- |
| `src/data_loader.py` | `load_heart_data` verifies the snapshot; `prepare_target` validates and separates diagnosis; `split_data` reproduces the stratified row split. |
| `src/preprocessing.py` | `build_preprocessor` returns fresh unfitted feature branches; `build_pipeline` adds a classifier after them. |
| `src/train.py` | `build_models` fixes configurations; `compare_models` calls `cross_validate` on training data; `select_model` applies the predeclared rule; `run_experiment` freezes the fit, evaluates once, and saves; `load_experiment_report` validates cached provenance. |
| `src/evaluate.py` | `evaluate_predictions` computes metrics and descriptive intervals; `wilson_interval` handles binomial uncertainty; `save_figures` saves six aggregate plots. |
| `src/model_utils.py` | `save_pipeline` writes a fitted artifact atomically; `load_pipeline` requires explicit trust; `validate_inputs` checks named inputs; `predict_records` returns a class and uncalibrated score. |
| `notebooks/03_model_training.ipynb` | Ten explained code sections call reusable modules, display actual results, and discuss interpretation and limitations. |
| `tests/conftest.py` | Synthetic non-patient data fixtures. |
| `tests/test_preprocessing.py` | Target, source, split, missingness, schema, and fold-local fitting tests. |
| `tests/test_training.py` | Fixed-seed model repeatability, selection policy, training-only comparison, overwrite protection, and known-count metric tests. |
| `tests/test_prediction.py` | Named-input validation, output bounds, explicit trust, and serialization consistency tests. |
| `tests/test_report.py` | Stale-cache rejection and completed-run integrity checks without more holdout predictions. |
| `reports/metrics/cv_summary.csv` | Full-precision model means, SDs, Brier scores, and train/validation gaps. |
| `reports/metrics/cv_folds.csv` | The 15 model/fold aggregate metric rows. |
| `reports/metrics/experiment.json` | Frozen selection rule, metrics, intervals, classification report, source/split/code/file fingerprints, configurations, versions, and limitations. |
| `models/heart_disease_pipeline.joblib` | Fitted preprocessing and Logistic Regression together. |
| `requirements.txt`, `constraints.txt` | Tested direct pins and a 116-package transitive constraint snapshot for Windows Python 3.12. |
| `pytest.ini` | Test discovery/import setup and convergence-warning enforcement. |

The README, `.gitignore`, dependency list, and historical audit introduction were
updated for this milestone. The source dataset and earlier notebooks were not changed.
Generated artifacts/reports/figures are local and ignored; no individual holdout
prediction rows or feature tables are exported.

## Verification and reproduction

Observed verification: **36 Pytest tests passed**. `pip check` reported no broken
requirements. The new notebook executed all 10 sections from a fresh kernel with
no error outputs. A second fresh-kernel execution verified the cached-run path
without retraining or reevaluating the holdout. The fitted pipeline was reloaded
and its scores matched before/after persistence on training rows. All six PNG
figures and the generated reports exist and have manifest fingerprints.

From the project root in PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip check
python -m pytest -q
python -m src.train                 # first run, when no outputs exist
```

Open notebook 03 to display an existing run. It validates code, source, package,
and output fingerprints before reusing it. `python -m src.train --overwrite` is
an explicit replay of the frozen experiment; it replaces generated outputs and
must not become a way to repeatedly choose settings against the holdout. This
phase does not implement experiment history or a model registry.

Only load your own trusted Joblib artifact. All 13 field names are required for
prediction; null values are allowed for learned imputation. Unknown field names,
target fields, invalid category codes, infinities, and entirely empty records are
rejected. Numerical strings can be parsed, but booleans are not measurements.
Input validation is a research schema check, not medical plausibility validation.

## Limits and next boundary

This historical single-cohort sample has no usable patient/time grouping in the
chosen columns. Earlier full-cohort EDA means the test set is not independent
external validation. Diagnostic input availability must match any future decision
time. Calibration, subgroup behavior, dataset shift, and clinical utility remain
unestablished. Reproduction is tested for the pinned Windows environment; exact
floating-point identity across different platforms is not promised.

No backend, frontend, other disease module, medical imaging, RAG assistant, or SHAP
implementation was added. Stop after Phase 3 and obtain approval before Phase 4.
