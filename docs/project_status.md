# MedIntel AI: Phase 2 repository audit and milestone plan

This document records the repository audit and the Phase 2 preprocessing milestone.
The broader platform described below is a proposal, not an implemented application.

**Historical snapshot:** The tables and verification below describe the end of
Phase 2. Phase 3 has since been authorized and completed; see the current
[Phase 3 report](model_training.md) and [README](../README.md) for the implemented
training modules, pinned dependencies, automated tests, and verified model results.

Phase 4 is now implemented as a separate frozen-model explanation module; see
[Explainable AI](explainable_ai.md). It preserves the trained artifact and all
three earlier notebooks, uses only training-background records, and generates
global and individual log-odds SHAP explanations. No Phase 5 application work has
started at the end of that milestone. The Phase 2 audit below remains a historical record.

Phase 5 is now implemented as a local modular FastAPI backend. See
[Backend API](backend_api.md) for the endpoint contracts, strict validation,
once-per-startup model/SHAP services, complete test results, and live verification.
The saved model, source dataset, notebooks 01-04, and historical metrics are
preserved. Phase 6 now adds the local React dashboard in `frontend/`, integrating
all six API endpoints with schema-driven validation, historical metrics,
individual SHAP, automated frontend tests and browser verification. See
[Frontend dashboard](frontend_dashboard.md). Databases, cloud deployment, and
additional diseases remain unimplemented.

Phase 7 now implements separate Patient, Doctor and Researcher interfaces, a
workspace selection landing page, shared responsive navigation, a disabled report
preview, grouped demonstration cases and verified model comparisons. The existing
API client and research features are reused. Patient pages make no API requests.
Workspace selection is not authentication or authorization. See
[Multi-role platform](multi_role_platform.md) for the audit, routes, preservation
checks and that milestone's results.

Phase 8 implements the synthetic Medical Report Explorer, a seventh independent
API endpoint, text-PDF extraction, optional local OCR, deterministic laboratory
parsing, manual transcription review and document-relative comparisons. Real
patient documents are prohibited. The Tesseract engine is absent on the current
machine, so image/scanned uploads give an explicit setup error while text PDFs
work. See [Medical document extraction](medical_document_extraction.md). No
classifier, dataset, historical metrics or SHAP mathematics changed.

Phase 9 implements reviewed-fact educational explanations in English, French and
Arabic, using an independent eighth JSON endpoint, existing interval comparisons,
versioned templates, strict validation, source traceability and deterministic
fallback. The UI supports explicit explanation, partial review, Arabic RTL,
language switching without extraction, and invalidation on review changes. No
local LLM runtime was found; no language model is configured or used. See
[Medical report explanations](medical_report_explanations.md). The seven previous
API contracts, historical research and Phase 8 parser/services remain preserved.
No database, deployment, commit or push was added. Phase 10 requires approval.

## Historical Phase 2 repository

| Path | Current state |
| --- | --- |
| `data/raw/processed.cleveland.data` | Official UCI processed Cleveland input, stored locally and ignored by Git rules. |
| `data/processed/` | Placeholder only; no processed datasets exported. |
| `notebooks/01_data_exploration.ipynb` | Executed exploration, with saved tables and five figures; preserved unchanged during this milestone. |
| `notebooks/02_data_preprocessing.ipynb` | Explained and executed target preparation, stratified split, and training-only preprocessing. |
| `src/__init__.py` | Package marker; no training implementation yet. |
| `models/`, `tests/`, `app/` | Placeholders; no prediction model, standalone test suite, or application. |
| `requirements.txt` | Seven initial packages: pandas, NumPy, matplotlib, seaborn, scikit-learn, Jupyter, and pytest. |
| `.venv/` | Existing Python 3.12.3 environment used to execute both notebooks. |
| `.gitignore` | Excludes local environments, caches, dataset directories, secrets, and model artifacts, retaining directory placeholders. |

Git is installed, but `C:/MedIntel-AI` has no initialized Git repository. There is no
repository-local Git configuration, branch, or remote to inspect. This milestone
does not initialize Git, create commits, or publish anything.

The existing requirements are unpinned. The preprocessing notebook prints the
actual pandas, NumPy, and scikit-learn versions used for its saved execution.
Exact dependency locking remains a reproducibility task before model experiments;
no packages were added or upgraded during this milestone.

## Dataset provenance and meaning

- Source: [UCI Heart Disease](https://archive.ics.uci.edu/dataset/45/heart+disease).
- Input: [processed Cleveland file](https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data), not a repackaged dataset.
- Local SHA-256: `a74b7efa387bc9d108d7d0115d831fe9b414b29ae7124f331b622b4efa0427c8`.
- Observed dimensions: 303 records and 14 columns, including the original diagnosis.
- Observed missingness: four `ca` values and two `thal` values across six records;
  question marks in this processed file are parsed as missing values.
- No exact duplicate rows were found in exploration.
- Binary target: original `num = 0` becomes 0 (absence); original `num = 1-4`
  becomes 1 (recorded presence). Neither diagnosis representation is an input feature.

Attribution: Janosi, A., Steinbrunn, W., Pfisterer, M., & Detrano, R. (1989).
*Heart Disease* [Dataset]. UCI Machine Learning Repository.
[DOI: 10.24432/C52P4X](https://doi.org/10.24432/C52P4X).
Cleveland collection: Robert Detrano, Cleveland Clinic Foundation.
UCI lists the dataset under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

This is a small historical cohort. The target represents recorded disease status,
not future onset or a validated clinical diagnosis generated by this project.
The 14-column source lacks usable patient grouping and chronology. Features such
as `ca` and `thal` contain diagnostic test information, so a future use case must
specify when these measurements would be available. The earlier notebook explored
the complete cohort; the later holdout is not independent external validation.

## Phase 2 implementation

1. Reuse the unmodified source and validate dimensions, numeric storage, finite
   non-missing values, and diagnosis codes. No full-dataset statistics are fitted.
2. Separate the binary target and retain the original diagnosis codes for audit.
3. Use a stratified 80/20 split with `random_state=42`: 242 training records and
   61 test records. Preserve indices and check that the subsets do not overlap.
4. Inspect raw training types, feature roles, missingness, and original target counts.
5. Build a `Pipeline` containing a `ColumnTransformer` with two branches:
   five measurements use median imputation and standardization; eight coded or
   discrete fields use most-frequent imputation and one-hot encoding.
6. Keep the template unfitted. Fit a clone on `X_train` only, and apply only
   `transform` to `X_test`. Both outputs have 28 features in the verified split.
7. Verify training medians, modes, scaler statistics, and learned categories;
   confirm parameters do not change during test transformation. Check finite
   outputs, label alignment, synthetic missing values, and an unseen category.

Each code cell has an explanation immediately before it. The notebook keeps
prepared tables and transformers in memory; it does not export patient data,
artifacts, or predictions. No prediction model is fitted.

## Verification results

- Executed all 11 code cells in a fresh kernel from `notebooks/`; all notebook
  assertions passed and no error outputs were produced.
- Verified 242 training rows, 61 test rows, and 28 aligned prepared features.
  Training labels contain 131 absent and 111 present records; test labels contain
  33 absent and 28 present records.
- Confirmed the original exploration notebook, including its saved outputs, and
  the raw source were byte-for-byte unchanged using SHA-256 checks.
- Checked the actual `.gitignore` with Git against nine example paths that must
  be ignored and six paths that must remain visible. All checks passed using a
  temporary repository outside this project; project Git configuration was unchanged.
- Ran `python -m pytest -q`: no tests were collected because `tests/` currently
  contains only its placeholder. This is not a passing standalone test suite;
  preprocessing validation currently lives in the executed notebook assertions.

No preprocessing execution errors remain. Dependency locking, a standalone test
suite for future reusable modules, and independent external validation remain
documented limitations rather than completed features.

## Proposed architecture for later approval

The current preprocessing boundary is `raw feature table -> preprocessing ->
prepared feature table`. A future prediction pipeline can append an estimator to
the unfitted preprocessing template. For cross-validation, use raw training
features so each fold fits its own transformers; do not cross-validate the
already prepared training table.

| Future layer | Responsibility | Proposed technology |
| --- | --- | --- |
| Disease research modules | Separate dataset definitions, targets, splits, preprocessing, training, and evaluation for each disease | Python, scikit-learn, XGBoost |
| Explanation layer | Global and individual associations with explicit model and feature provenance | SHAP; Grad-CAM for a later imaging module |
| Prediction service | Validate inputs and load a versioned full pipeline; return experimental outputs and metadata | FastAPI, Pydantic |
| Browser interface | Accessible forms, research results, explanations, and model information | React, TypeScript, Tailwind CSS |
| Imaging research module | Independent dataset licensing review, patient-level splitting, training, and evaluation | PyTorch |
| Grounded assistant | Retrieve trusted documents and cite sources; keep retrieval separate from prediction | Retrieval-augmented generation |
| Metadata and operations | Non-sensitive model/run metadata, experiment tracking, reproducible builds, and CI | PostgreSQL, SQLAlchemy, MLflow, Docker, GitHub Actions |

These layers are proposed boundaries only. No backend, frontend, database,
imaging system, assistant, registry, or deployment scaffolding has been created.

## Milestone sequence

1. **Current milestone:** repository audit and Phase 2 preprocessing verification.
2. **After approval:** lock the experiment environment; extract reusable data and
   preprocessing code; compare Logistic Regression, Random Forest, and XGBoost
   through training-only stratified cross-validation. Select using a documented
   metric trade-off, then perform the final holdout evaluation and save the full pipeline.
3. Review explainability and its limitations before adding SHAP outputs.
4. Review the API contract before implementing the backend, then the frontend.
5. Review each additional disease dataset independently, followed by imaging,
   grounded assistance, and operations as separate verified milestones.

At each boundary, report actual checks and unresolved limitations, then obtain
approval before proceeding. No metrics or clinical validation claims exist yet.
