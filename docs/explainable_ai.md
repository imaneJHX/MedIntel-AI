# Phase 4: SHAP explanations of the frozen heart disease model

Phase 4 explains the existing Logistic Regression pipeline at
`models/heart_disease_pipeline.joblib`. It does not retrain, replace, or alter the
model. Explanations describe model behavior, not causation, medical diagnoses,
clinical risk estimates, treatment recommendations, or clinical approval.

## Provenance and background

The original source is the [official UCI processed Cleveland dataset](https://archive.ics.uci.edu/dataset/45/heart+disease).
Attribution: Janosi, A., Steinbrunn, W., Pfisterer, M., & Detrano, R. (1989).
*Heart Disease* [Dataset]. UCI Machine Learning Repository.
[DOI: 10.24432/C52P4X](https://doi.org/10.24432/C52P4X).
Cleveland collection: Robert Detrano, Cleveland Clinic Foundation.
UCI lists the data under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The source has 303 records and 14 original columns. The binary label represents
recorded presence (`num=1-4`) versus absence (`num=0`), not future disease onset.
Seed-42 stratification reproduces the exact 242/61 split from Phases 2 and 3.
Split fingerprints are checked against the original experiment manifest.

The saved artifact's SHA-256 is
`82ebbcac02ce7dafd841f1f44d477b758ad05124f7f2b767b9fc8bae07546f4a`.
The implementation verifies that artifact against `reports/metrics/experiment.json`
and confirms it contains the fitted `ColumnTransformer` and binary
`LogisticRegression`. Prior model metrics are read from that existing manifest;
Phase 4 does not repeat model selection or change the threshold.

**SHAP 0.54.1** is installed. Existing model-era package versions were retained:
Python 3.12.3, scikit-learn 1.9.1, NumPy 2.5.4, pandas 3.0.6, matplotlib 3.11.2,
and Joblib 1.6.0. Added constraints are SHAP, slicer 0.0.8, and tqdm 4.70.1.

All **242 training records** are transformed by the frozen preprocessor to form
the background. Independent masker's `max_samples` is explicitly set to 242, so
its default 100-row subsampling cannot silently change the reference distribution.
No test observations enter the background, and no fitting occurs. Every one of
the **61 held-out records** receives a global explanation.

## Method and explanation units

We use [SHAP LinearExplainer](https://shap.readthedocs.io/en/latest/generated/shap.LinearExplainer.html)
with [Independent masking](https://shap.readthedocs.io/en/latest/generated/shap.maskers.Independent.html)
on the 28 transformed inputs. This is the independence/interventional attribution
convention in transformed space. Its name does not imply a causal intervention
on a person. It ignores correlations and the mutual exclusivity of dummy columns.
Other background/representation/dependence choices can allocate credit differently.

For transformed feature vector z, coefficient vector beta, intercept b, and training
background mean m, the linear model and its explanation satisfy:

```text
decision log-odds = b + sum(beta_j * z_j)
SHAP baseline    = b + sum(beta_j * m_j)
SHAP value_j     = beta_j * (z_j - m_j)
baseline + sum(SHAP values) = decision log-odds
model score      = sigmoid(decision log-odds)
sigmoid(t)       = 1 / (1 + exp(-t))
```

Positive contributions raise positive-class log-odds relative to the baseline;
negative contributions lower them. Sigmoid is monotonic, so score direction agrees,
but log-odds contributions are not probability-point changes. Do not add them to
a probability. The returned score has not been clinically calibrated.

The fitted intercept is **0.0361938806**, while the training-background SHAP
baseline is **0.0088652242 log-odds**. They differ because the background's encoded
means contribute to the model. Sigmoid of the baseline is not the mean background
score: averaging and the nonlinear sigmoid do not commute.

Across all 61 explanations, observed maximum absolute errors are:

| Check | Maximum error | Required tolerance |
| --- | --- | --- |
| Baseline + SHAP sum versus decision log-odds | 1.7764e-15 | 1e-10 |
| Sigmoid of reconstruction versus model score | 1.6653e-16 | 1e-12 |
| SHAP values versus analytic linear contributions | 0 | 1e-10 |

These establish mathematical consistency for the frozen model, not clinical validity.

## Encoded-feature alignment

The five measurement outputs are standardized values. The eight coded/discrete
variables are one-hot encoded, with all learned categories retained. Output names
come directly from `get_feature_names_out`; branch output slices, original column
lists, encoder categories, and any dropped-category metadata determine ownership.
No hardcoded coefficient positions or prefix-based guesses are used.

The mapping is checked against coefficient count, transformed arrays, and SHAP
dimensions. Unsupported preprocessing width changes fail explicitly. A dummy
value of zero may have a nonzero attribution because SHAP compares it with its
background mean, not with zero. Category codes themselves are not treated as
continuous measurements.

## Actual global results

Mean absolute SHAP values below describe influence over the 61 held-out records.
All values are in log-odds; no feature was assumed influential before measurement.

| Rank | Transformed feature | Mean absolute SHAP |
| --- | --- | --- |
| 1 | `categorical__ca_0.0` | 0.7360 |
| 2 | `categorical__cp_4.0` | 0.5156 |
| 3 | `categorical__thal_7.0` | 0.3884 |
| 4 | `numeric__thalach` | 0.3300 |
| 5 | `categorical__sex_1.0` | 0.3113 |
| 6 | `categorical__sex_0.0` | 0.3055 |
| 7 | `categorical__slope_2.0` | 0.3017 |
| 8 | `categorical__thal_3.0` | 0.2597 |
| 9 | `categorical__cp_3.0` | 0.2485 |
| 10 | `numeric__oldpeak` | 0.2438 |

In this fitted representation, an active `ca=0` indicator has a negative coefficient
and decreases the output relative to its background mean; inactive `ca=0` can have
a positive contribution. `ca` records vessels visualized by fluoroscopy. Active
chest-pain code 4 and thallium-test code 7 have positive coefficients. Higher
maximum heart rate has a negative conditional coefficient. These are statements
about this model; they do not establish disease mechanisms or clinical recommendations.

Full one-hot coding makes both sex indicators contribute to the same binary
contrast. Their separate rankings should not be read as independent causal effects.
Sensitive demographic attribution warrants further fairness/subgroup investigation,
not unsupported conclusions about a population.

## Grouped original-variable importance

We provide two explicitly different summaries:

1. **Sum of mean absolute encoded contributions:** sum each dummy column's mean
   absolute contribution. This is the charted magnitude-sum ranking and does not
   cancel positive and negative dummy effects within a record.
2. **Mean absolute net contribution:** first sum signed dummy contributions within
   each record, then average absolute values. Cancellation is possible, so it may
   be smaller. Signed per-record groups preserve the overall additive SHAP total.

Neither summary recomputes SHAP using a different game over original-variable
coalitions. Variables with multiple dummy columns have multiple terms in the
magnitude sum; representation matters.

| Original variable | Sum of encoded mean magnitudes | Mean absolute net contribution |
| --- | --- | --- |
| `ca` | 1.0860 | 0.9752 |
| `cp` | 0.8804 | 0.7222 |
| `thal` | 0.6916 | 0.6104 |
| `sex` | 0.6167 | 0.6167 |
| `slope` | 0.5362 | 0.4934 |
| `thalach` | 0.3300 | 0.3300 |
| `oldpeak` | 0.2438 | 0.2438 |
| `trestbps` | 0.2424 | 0.2424 |
| `exang` | 0.2295 | 0.2295 |
| `restecg` | 0.1823 | 0.1752 |
| `chol` | 0.1401 | 0.1401 |
| `fbs` | 0.0569 | 0.0569 |
| `age` | 0.0462 | 0.0462 |

Among the requested illustrative variables, chest-pain type is highly influential
in this model. Maximum heart rate has more measured influence than cholesterol
or age here. Resting blood pressure and exercise-angina coding also contribute.
The fitted age coefficient is slightly negative and its attribution magnitude is
small; this does not mean age protects against disease or lacks medical relevance.
These are conditional associations under regularization and correlated inputs.

## Individual public-data examples

Selection is deterministic in the existing holdout order: first predicted-present
and first predicted-absent record, plus the first misclassified record not already
selected when available. Positions below are zero-based **within the holdout**, not
patient identifiers. The notebook displays the original 13 values from the public
UCI records with the source row index removed. The JSON report omits full raw profiles.

| Example | Holdout position | Predicted | Recorded | Uncalibrated score | Reconstructed log-odds |
| --- | --- | --- | --- | --- | --- |
| First predicted present | 1 | Present | Absent | 0.638220 | 0.567646 |
| First predicted absent | 0 | Absent | Absent | 0.238645 | -1.160122 |
| Additional misclassification | 17 | Present | Absent | 0.730097 | 0.995115 |

The predicted-present example is itself a false positive. Its largest upward
contribution is standardized resting blood pressure (**+0.5659**), followed by
the chest-pain-code-4 indicator (**+0.5347**). Its largest downward contribution is
the active `ca=0` indicator (**-0.5781**). Together with the other terms, the output
lands above the fixed 0.5 threshold, despite the recorded absent label.

For the predicted-absent example, the chest-pain-code-4 indicator contributes
**+0.5347**, while `ca=0` contributes **-0.5781** and maximum heart rate contributes
**-0.5513**. The complete signed sum is **-1.168987**, giving final log-odds
**-1.160122** after adding the common baseline. The negative contributions dominate;
this describes the classifier, not a medical rule ruling out disease.

The additional error at position 17 receives upward contributions from inactive
`ca=0` (**+0.9102**), resting blood pressure (**+0.5659**), and the flat-slope
indicator (**+0.3296**). Chest-pain indicators oppose that direction, but the final
score remains 0.730097 even though the recorded class is absent. A coherent SHAP
explanation can accompany a wrong prediction.

## Visualizations

All figures are 200-DPI PNG exports under `reports/figures/explainability/`:

- `shap_beeswarm.png`: each point is one transformed-feature contribution;
  horizontal position is log-odds contribution and color is the transformed value
  where meaningful. The combined remaining-features row has no single variable's
  color interpretation. Jitter is seeded and carries no scientific meaning.
- `global_mean_absolute_shap.png`: top transformed inputs by mean absolute SHAP.
- `grouped_original_importance.png`: original variables ranked by the sum of encoded magnitudes.
- `waterfall_positive.png`: first predicted-present example, explicitly a false positive.
- `waterfall_negative.png`: first predicted-absent example.
- `waterfall_misclassified.png`: a distinct additional error example.

Waterfalls add signed contributions to the baseline to reach log-odds. The plotted
input values are transformed (scaled measurements or dummy indicators); original
input values are shown separately in the notebook. A score is not a clinical risk.

## Reusable implementation and verification

`src/explainability.py` contains the following boundaries:

- `load_explanation_model` reuses the trusted persistence utility and verifies
  the Phase 3 manifest; `extract_components` checks estimator and transformer types.
- `feature_mapping` aligns all outputs with original variables and category metadata.
- `transform_records` validates original inputs and calls only frozen `transform`.
- `build_explainer` uses all training-background rows and fingerprints model state.
- `explain_global` and `explain_individual` return named SHAP Explanation objects.
- `validate_reconstruction` checks the decision value, analytic terms, and sigmoid score.
- `group_contributions` preserves additive totals; `global_importance` creates both
  encoded and clearly defined grouped summaries.
- `individual_summary` creates dashboard-ready attribution metadata without a raw profile.
- `run_explainability` writes only Phase 4 figures/JSON; `load_explainability_report`
  rejects stale code, environment, model/source, and figure fingerprints.

The workflow fingerprints both in-memory pipeline state and frozen files.
`tests/test_explainability.py` checks loading, type, dimensions, background size,
finiteness, baseline, additivity, sigmoid conversion, grouping, invalid inputs,
repeatability, no fit calls, model preservation, example selection, and report integrity.
The complete test suite must pass, including previous phases' tests. Existing tests
may train synthetic fixtures; Phase 4 never retrains or overwrites the saved UCI model.

## Reproduce

Verified execution results: **52 tests passed** across the complete suite and
`pip check` found no broken requirements. All 12 explained notebook code cells
executed from a fresh kernel with no error outputs. Six 200-DPI PNGs were verified
and embedded in the notebook, including three distinct local examples. A final
fresh-kernel run validated and reused the completed XAI report. All three previous
notebooks, the source dataset, fitted artifact, and Phase 3 experiment report
remain byte-for-byte unchanged. No execution errors remain.

From `C:\MedIntel-AI` in PowerShell, with the original Phase 3 artifact present:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip check
python -m src.explainability
python -m pytest -q
```

Open `notebooks/04_explainable_ai.ipynb`, select the environment, and run all cells
in a fresh kernel. `reports/metrics/explainability.json` contains global rankings,
feature mapping, example attribution summaries, reconstruction diagnostics, and
provenance. Existing outputs are validated and reused. After reviewing a Phase 4
implementation change, `python -m src.explainability --overwrite` regenerates only
XAI outputs; it never calls training or saves a classifier.

The existing ignore rules already cover all generated XAI figures and JSON.
The executed notebook embeds the figures and requested public examples. Never
put private patient inputs or identifiable records into notebook outputs or Git.

## Limits and phase boundary

The cohort is small, historical, and not externally validated. Earlier exploration
used the full cohort. The chosen columns lack usable patient/time grouping, and
diagnostic features may be unavailable at an intended earlier decision time.
Explanations and rankings may change across populations, representations, and
background choices; mathematical consistency is not robustness, fairness, or clinical
validation. No clinical calibration, treatment guidance, or regulatory approval is claimed.

No Phase 5 API, frontend, database, or deployment was implemented. Stop after Phase 4
and obtain approval before proceeding.
