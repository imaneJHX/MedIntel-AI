# MedIntel AI

A professional healthcare AI prediction and decision-support research prototype.

**Intelligent Healthcare Research & Analysis Platform** — dedicated educational Patient, demonstration Doctor, and analytical Researcher workspaces.

This repository contains explained exploration, preprocessing, model-training, and SHAP notebooks using the official UCI Heart Disease processed Cleveland dataset. Phase 3 compares Logistic Regression, Random Forest, and XGBoost through training-only cross-validation and saves one selected full pipeline. Phase 4 explains that frozen model without retraining. Phase 5 serves the model and individual explanations through a local FastAPI backend. Phase 6 adds a local React dashboard with schema-driven inputs, experimental scores, and individual SHAP visualizations. This is an educational research prototype, not a clinically validated diagnostic device. Other disease modules remain future work.

## Local dashboard

Start the existing FastAPI server on port 8000 if it is not already running, then open a second terminal:

```powershell
cd C:\MedIntel-AI\frontend
npm ci
npm run dev
```

Open [MedIntel AI](http://127.0.0.1:3000) and choose a workspace:

- [Patient Portal](http://127.0.0.1:3000/patient): general educational information, source links, and the synthetic Medical Report Explorer. Explicit upload, local extraction, manual review and document-relative intervals; no disease prediction.
- [Clinical Workspace](http://127.0.0.1:3000/doctor): grouped fabricated case inputs, variable reference, experimental classification and SHAP.
- [AI Research Lab](http://127.0.0.1:3000/research): preserved dashboard, prediction, SHAP, verified three-model comparison, experiments and methodology.

In Doctor or Researcher, use **Load fabricated example** to explore prediction and SHAP. Scores are experimental and uncalibrated. Choosing a workspace does not authenticate or verify anyone. Temporary analysis inputs are shared between Doctor and Researcher in memory; visiting Patient or the landing page clears them. Refresh also clears them. Use fabricated cases only.

See [frontend setup](frontend/README.md), the [frontend implementation history](docs/frontend_dashboard.md), the [multi-workspace guide](docs/multi_role_platform.md), [document extraction](docs/medical_document_extraction.md) and [Phase 9 multilingual report explanations](docs/medical_report_explanations.md). The seven previous API contracts, model artifacts, dataset and earlier notebooks are preserved. Phase 10 requires approval. Legacy `/predict`, `/model`, and `/explainability` links redirect to their research equivalents; `/` is the workspace selector.

## Synthetic Medical Report Explorer

Open [Medical Report Explorer](http://127.0.0.1:3000/patient/reports). Download one of the supplied synthetic PDF samples, select it, acknowledge that it contains no real personal or patient information, and click **Extract synthetic report**. Review every extracted number, unit and printed interval. Corrections remain separate from original snippets, confirmation means transcription review only, and **Clear report** removes temporary browser state.

The new `POST /api/v1/reports/extract` accepts one PDF/PNG/JPEG plus `synthetic_only=true` as multipart form data. Limits: 5 MiB, five PDF pages, 4096 pixels per image side and eight million pixels. Files stay in RAM; local extraction runs in a time- and memory-bounded subprocess. No medical documents, extracted contents or corrections are persisted, and uploads never invoke the heart disease classifier.

**OCR status:** Tesseract is not installed on the implementation machine. Embedded-text PDFs work. PNG/JPEG and scanned PDFs return an explicit OCR-unavailable error until a local Tesseract installation with English language data is configured. No cloud OCR, LLM service or automatic OCR-model download is used. See the [Windows setup instructions](docs/medical_document_extraction.md).

After confirming at least one transcription, click **Explain My Report**. Phase 9 adds a calculated overview, plain-language summary, individual source-linked measurement explanations, and questions for a healthcare professional in **English, French and Arabic**. Arabic explanation output supports right-to-left layout. Language changes preserve corrections and never repeat upload or OCR. Any review edit, reset or confirmation change clears the previous explanation; Clear Report and leaving the report route remove temporary state.

Explanations use offline, versioned educational templates and verified NLM source links. **No language model is configured or used.** The independent JSON endpoint `POST /api/v1/reports/explain` revalidates 1–50 reviewed synthetic measurements, printed bounds, matching unit notation and unique IDs. Unknown facts remain unknown, and unreviewed rows are excluded by the UI or rejected by the API. Confirmation is transcription review, not clinical validation. No diagnoses, treatment recommendations or disease probabilities are produced. See the [architecture, API and limitations](docs/medical_report_explanations.md).

## Project structure

```text
MedIntel-AI/
├── data/
│   ├── raw/
│   └── processed/
├── notebooks/
│   ├── 01_data_exploration.ipynb
│   ├── 02_data_preprocessing.ipynb
│   ├── 03_model_training.ipynb
│   └── 04_explainable_ai.ipynb
├── src/
│   ├── __init__.py
│   ├── data_loader.py
│   ├── preprocessing.py
│   ├── train.py
│   ├── evaluate.py
│   ├── model_utils.py
│   └── explainability.py
├── models/
├── reports/
│   ├── figures/
│   └── metrics/
├── tests/
├── app/
├── frontend/
├── docs/
├── README.md
├── requirements.txt
├── constraints.txt
├── pytest.ini
└── .gitignore
```

| Path | Purpose |
| --- | --- |
| `data/raw/` | Original source datasets, kept locally and excluded from Git. |
| `data/processed/` | Cleaned and transformed datasets, kept locally and excluded from Git. |
| `notebooks/` | Jupyter notebooks for exploration, analysis, and research experiments. |
| `src/` | Reusable Python code for data preparation, prediction, and evaluation. |
| `src/__init__.py` | Marks `src` as a Python package. |
| `models/` | Saved model artifacts, kept locally and excluded from Git. |
| `tests/` | Automated tests for the Python code. |
| `frontend/` | React dashboard, typed API client, schema-driven forms, SHAP charts, and frontend tests. |
| `app/` | Modular FastAPI routes, strict Pydantic schemas, configuration, and once-per-startup inference services. |
| `README.md` | Project overview, folder guide, and setup instructions. |
| `requirements.txt` | Exact direct dependency versions, applying the tested constraints snapshot. |
| `constraints.txt` | Pinned transitive dependency versions from the tested Windows Python 3.12 environment. |
| `reports/` | Locally generated aggregate metrics and six figures; excluded from Git except placeholders. |
| `pytest.ini` | Test discovery, project import path, and convergence-warning checks. |
| `.gitignore` | Rules excluding local environments, caches, sensitive files, and generated artifacts from Git. |

Empty folders contain `.gitkeep` placeholders so Git can preserve the structure.

## Local setup

Create and activate a virtual environment in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip check
```

## Dependencies

- `pandas` and `numpy`: data manipulation and numerical computing.
- `matplotlib` and `seaborn`: data visualization.
- `scikit-learn`: machine learning and evaluation tools.
- `jupyter`: interactive research notebooks.
- `pytest`: automated testing.
- `xgboost`: the boosted-tree candidate.
- `scipy` and `joblib`: numerical support and full-pipeline persistence.
- `nbformat` and `nbclient`: notebook validation and fresh-kernel execution.
- `shap`: global and individual additive explanations of the frozen Logistic Regression model.
- `fastapi`, Pydantic v2, `pydantic-settings`, and `uvicorn`: API routing, validation, configuration, and local serving.
- `httpx`: API tests and live HTTP verification.

Direct dependencies and transitive constraints are pinned to the versions actually tested. The constraints snapshot targets the existing Windows Python 3.12 environment; it is not a guarantee of identical results on other platforms or library versions.

## Data exploration

Open [01_data_exploration.ipynb](notebooks/01_data_exploration.ipynb) in VS Code or Jupyter, select the project's virtual environment, and run all cells in order. Each code cell has an accompanying explanation.

The notebook downloads the [official UCI processed Cleveland file](https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data) into `data/raw/` on its first run, then reuses that local copy. It inspects records, column types, missing values, and distributions without training any model. Dataset attribution and variable definitions are included in the notebook.

## Data preprocessing

Run [02_data_preprocessing.ipynb](notebooks/02_data_preprocessing.ipynb) independently using the same environment. It prepares the binary diagnosis target and creates a reproducible, stratified 80/20 split before fitting any transformations. Missing-value imputation, measurement scaling, and categorical encoding learn from training features only; the test features use the fitted pipeline without refitting.

Every code cell is explained. Executed checks verify training-only statistics, aligned outputs, and handling of missing and unseen values. The notebook keeps an unfitted pipeline template for future use with cross-validation and does not train a prediction model or export artifacts.

The [repository audit and milestone plan](docs/project_status.md) records the existing files, dataset limitations, preprocessing decisions, and proposed architecture for later approval. The project uses Git and is published at [imaneJHX/MedIntel-AI](https://github.com/imaneJHX/MedIntel-AI). Raw datasets, model artifacts, secrets and generated reports remain excluded.

## Model training and evaluation

Open [03_model_training.ipynb](notebooks/03_model_training.ipynb) and run all cells. It uses reusable code from `src/`, with explanations of each model, parameter choices, metrics, plots, and limitations. The existing exploration and preprocessing notebooks and their outputs are preserved.

For a first run from the project root:

```powershell
python -m src.train
python -m pytest -q
```

The loader uses the existing official UCI file and verifies its SHA-256. The original diagnosis `num=0` maps to 0 (recorded absence) and `num=1-4` maps to 1 (recorded presence). Neither diagnosis field is included in the 13 predictors. The target describes recorded status, not future disease onset.

The fixed stratified split uses seed 42 and keeps 242 training records and 61 test records. Five-fold stratified cross-validation uses **raw training features and complete preprocessing/classification pipelines**. Thus every fold learns its own medians, modes, scaling parameters, and category vocabulary. The full training fit produces the same 28-feature design as Phase 2.

Selection prioritizes mean positive-class recall among models whose mean CV precision is at least 0.60, with F1 and ROC-AUC as tie-breakers. If none meet the guardrail, F1 is the fallback priority. This guardrail is a research heuristic, not a clinical requirement. Threshold 0.5 is fixed, configurations are modest and predetermined, and no hyperparameter or threshold search is performed. Only the selected model receives final holdout evaluation; test performance does not change selection.

Results, their uncertainty, the actual comparison table, and file/function explanations are in [the Phase 3 report](docs/model_training.md). The saved full pipeline is `models/heart_disease_pipeline.joblib`. Aggregate JSON/CSV results live in `reports/metrics/`; figures live in `reports/figures/`.

Existing outputs are protected by default. The notebook validates and reuses a completed run, checking implementation, dataset, environment, and generated-file fingerprints. An explicit deterministic replay is available:

```powershell
python -m src.train --overwrite
```

This replaces generated experiment outputs and reevaluates the same frozen design. Do not use repeated holdout results to select new settings. If code or data changes, review the experiment design before starting another run. Retain old reports externally if you need a history; a model registry is not implemented yet.

To load the local artifact you created and obtain validated research outputs:

```python
from src.model_utils import load_pipeline, predict_records

pipeline = load_pipeline("models/heart_disease_pipeline.joblib", trusted=True)
# records must provide all 13 named feature fields; explicit null values are imputed.
# results = predict_records(pipeline, records)
```

Joblib artifacts can execute code on load. Load only your own trusted artifacts. The utility rejects missing field names, extra/target fields, invalid category codes, infinities, and entirely empty records. It accepts null feature values for training-learned imputation. Returned `model_score` values are **uncalibrated experimental scores**, not real-world disease probabilities.

## Explainable AI

Open [04_explainable_ai.ipynb](notebooks/04_explainable_ai.ipynb) to inspect SHAP explanations of the saved Logistic Regression. It uses all 242 training records as the background and explains the unchanged 61-record holdout. No preprocessing or classifier fitting occurs in the explanation workflow.

```powershell
python -m src.explainability
python -m pytest -q
```

`shap.LinearExplainer` uses independent masking in the exact 28-feature transformed representation. Contributions are additive in **positive-class log-odds**. The notebook verifies that baseline plus SHAP contributions reconstructs the model decision value, and that applying sigmoid reproduces its uncalibrated positive-class score. Log-odds contributions are never added to probabilities.

The six figures include a beeswarm, transformed-feature importance, grouped original-variable importance, and positive/negative/error waterfalls. Outputs are `reports/figures/explainability/` and `reports/metrics/explainability.json`; [the Phase 4 report](docs/explainable_ai.md) documents actual rankings, examples, methodology, diagnostics, and limitations. Original input values for selected public UCI examples appear only in the notebook; JSON omits full raw profiles and patient-identifying fields.

Existing XAI results are verified and reused. To regenerate only Phase 4 outputs after a reviewed change, use `python -m src.explainability --overwrite`. This never calls the training command or modifies the model artifact. SHAP 0.54.1 and its added dependencies are pinned without changing the versions used by the frozen model.

SHAP explains this model relative to its background. Independent masking ignores correlations and one-hot exclusivity; grouping encoded magnitudes is not a new coalition explanation over original variables. An explanation can be mathematically correct even when the prediction is wrong. No causal, clinical-risk, treatment, or diagnostic conclusions follow from a feature ranking.

## Local backend API

The Phase 5 backend serves the existing trusted pipeline without fitting or changing it. FastAPI lifespan initializes the model and the training-only SHAP background once. Thin routes call typed services; the shared Pydantic input contract also supplies form labels/options used by the Phase 6 React frontend. No database or authentication platform is implemented.

From the project root, after installing requirements:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

Open [Swagger UI](http://127.0.0.1:8000/docs), [ReDoc](http://127.0.0.1:8000/redoc), or [OpenAPI JSON](http://127.0.0.1:8000/openapi.json). These URLs require the local server to be running.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | Process liveness, independent of model availability. |
| GET | `/api/v1/ready` | Model and explanation readiness; 503 when unavailable. |
| GET | `/api/v1/models/heart-disease` | Safe model metadata and historical experimental metrics. |
| GET | `/api/v1/models/heart-disease/schema` | All 13 fields, categories, units, training support limits, and null policy. |
| POST | `/api/v1/predict/heart-disease` | One recorded-status classification and uncalibrated score. |
| POST | `/api/v1/explain/heart-disease` | One individual SHAP explanation with 28 log-odds contributions. |
| POST | `/api/v1/reports/extract` | Synthetic-only report transcription, document-relative comparisons and general educational definitions; multipart upload, independent of model services. |
| POST | `/api/v1/reports/explain` | Offline English/French/Arabic educational explanations of reviewed synthetic measurements; structured JSON only, independent of model/OCR services. |

Example PowerShell request using fabricated demonstration inputs:

```powershell
$body = @{
    age = 55; sex = 1; cp = 4; trestbps = 140; chol = 240
    fbs = 0; restecg = 0; thalach = 150; exang = 0; oldpeak = 1.0
    slope = 2; ca = 0; thal = 3
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/v1/predict/heart-disease' -ContentType 'application/json' -Body $body
python -m pytest -q
```

All 13 field names are required. Explicit `null` values use the frozen imputer; an entirely null record is rejected. Category codes must be JSON integers; measurements must be finite JSON numbers. The API supports the observed training numeric ranges, not claimed medical normal ranges. Strings, booleans, extra fields, unsupported categories/ranges, and malformed bodies receive sanitized errors.

Configuration uses `MEDINTEL_` environment variables or an optional ignored `.env`; [.env.example](.env.example) contains only development defaults. CORS explicitly allows local React development origins, credentials are disabled by default, and inference JSON bodies retain their 16-KiB default limit. Only the report endpoint accepts bounded multipart bodies with its separate file limit and envelope allowance. Requests are not persisted or logged by the application. The documented Uvicorn command disables access logs as an additional privacy measure.

[Backend documentation](docs/backend_api.md) explains every major component, request/response contracts, error codes, lifecycle, dependencies, local measurements, and reproduction. Actual live verification is recorded locally in `reports/metrics/backend_verification.json`. This local research service has no authentication, TLS, rate limiting, or clinical/regulatory validation; do not expose it publicly or submit real patient data.

## Limitations and responsible interpretation

The source is a small historical Cleveland cohort, and earlier EDA examined the full cohort. The holdout is therefore not independent external validation. The 14-column source cannot support reliable patient-group or temporal splitting, and diagnostic features such as `ca` and `thal` may be unavailable at a proposed future decision time. Relationships learned from these data are associations, not causal effects.

Cross-validation fold standard deviations and descriptive test intervals show substantial uncertainty. Calibration is assessed on only 61 records and is not established for a wider population; no calibrator is fitted on test data. No experimental output should be used as a medical diagnosis, treatment recommendation, or validated risk estimate. External validation, feature-availability review, cohort/bias assessment, and appropriate governance would be needed for any clinical use case.

## Data handling

Keep datasets in `data/raw/` or `data/processed/` and model artifacts in `models/`. These folders are ignored except for their placeholders. Keep credentials in local environment files, which are also ignored. Review files before committing; ignore rules do not remove files already tracked by Git.

Generated plots and aggregate report files are also ignored. The executed training notebook embeds aggregate results and figures for review without exporting individual input records or holdout prediction rows. The XAI notebook also displays the explicitly selected public, deidentified examples requested for explanation. Never place private patient information in notebooks, tests, logs, or Git history. The backend does not store submitted inputs. The frontend keeps temporary inputs in memory. No other disease module, imaging pipeline, or assistant is included in these phases.
