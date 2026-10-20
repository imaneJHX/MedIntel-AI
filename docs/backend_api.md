# Phase 5: local FastAPI model serving and SHAP API

This backend serves the existing **frozen Logistic Regression pipeline** and the
Phase 4 explanation engine. It does not retrain, download, replace, or modify a
model. Outputs classify recorded UCI disease status; they are not medical
diagnoses, treatment advice, or clinically calibrated disease-risk estimates.

## Architecture and important components

```text
HTTP request
  -> controlled CORS and bounded-body/privacy middleware
  -> strict shared Pydantic HeartRecord
  -> thin versioned route
  -> once-per-process model/explanation service
  -> existing src/ frozen preprocessing, prediction, and SHAP utilities
  -> typed response with research disclaimer
```

| Component | What it does and why |
| --- | --- |
| `app/main.py` | `create_app` builds the API; lifespan initializes resources once in a startup thread pool, retains safe unavailable states on failure, and releases references on shutdown. Its injectable loaders support lifecycle testing. |
| `app/core/config.py` | `Settings` reads `MEDINTEL_` environment variables and optional `.env`; validates explicit CORS origins and bounded request-size configuration. |
| `app/core/exceptions.py` | Defines one typed error envelope and sanitizes validation/HTTP/service errors. Request values and internal exception strings are omitted. |
| `app/core/security.py` | Counts actual streamed bytes, rejects unsupported body formats, adds no-store/nosniff headers, suppresses unexpected exception details, and standardizes rejected CORS preflights. |
| `app/schemas/patient.py` | Defines the authoritative 13-field API contract, labels, units, category options, and observed training support ranges. Both prediction and form-schema endpoints use it. |
| `app/schemas/prediction.py` | Defines class labels, the score/threshold response, and research disclaimer. |
| `app/schemas/explanation.py` | Defines original inputs, 28 named contributions, their original-variable mappings, baseline/output units, and strongest opposing contributions. |
| `app/schemas/model.py` | Defines public health, readiness, model metadata, and frontend-form schema responses. |
| `app/services/model_service.py` | Loads one trusted artifact, verifies versions/schema/training reference, locates the actual class-1 column, converts validated inputs with the existing utility, and scores under the saved threshold. |
| `app/services/explainability_service.py` | Builds the existing SHAP engine once using only training rows; explains one submitted row and verifies reconstruction. |
| `app/api/routes/` | Four small modules implement health/readiness, model metadata/schema, prediction, and explanation HTTP endpoints. Routes delegate computation to services. |
| `tests/api/` | New API-only fixtures and five test modules cover contracts, serving equivalence, SHAP, validation, security, and resource lifecycle. Earlier tests are preserved. |
| `.env.example` | Optional development settings without credentials. |

The existing `src/` implementations are unchanged. There is no new preprocessing
fit, SHAP algorithm, global SHAP export, or training path inside the API. The API
can be tested with dependency overrides without changing the underlying model.

## Model audit and provenance

The trusted local artifact is `models/heart_disease_pipeline.joblib`, containing
the fitted `ColumnTransformer` and binary Logistic Regression. Its fingerprint is:

```text
82ebbcac02ce7dafd841f1f44d477b758ad05124f7f2b767b9fc8bae07546f4a
```

Startup validates the artifact against the recorded fingerprint, checks tested
Python/library versions, and checks the exact original/transformed feature schema.
It reads the existing Phase 3 manifest for threshold **0.5** and uses its historical
strict `score > threshold` comparison. The class-1 probability-column index comes
from `pipeline.classes_`; it is not guessed from a column position.

The source remains the [official UCI Heart Disease processed Cleveland dataset](https://archive.ics.uci.edu/dataset/45/heart+disease).
Source attribution and limitations remain in the earlier phase documents. The
target maps original `num=0` to recorded absence and `num=1-4` to presence. The
fitted design has 13 original inputs and 28 transformed features.

The original seed-42 training partition is reconstructed once at startup. Its
index fingerprint is checked against Phase 3; its 242 rows supply the SHAP
background and verify numeric support limits. Test rows are not used for these
limits, background construction, fitting, or model revision. Startup also checks
category options against the fitted one-hot encoder and smoke-tests scoring on
one training row. Historical evaluation metrics are read, not recomputed.

The serving bundle needs the trusted model, `reports/metrics/experiment.json`,
the matching package environment, and the original public dataset for background
initialization. It does not depend on plot files or global XAI exports, and no
per-request source/artifact reads are performed. All files must come from a
trusted project owner; matching a colocated checksum is consistency checking,
not artifact signing or protection against a compromised bundle.

## Endpoints

| Method | Path | Successful output |
| --- | --- | --- |
| GET | `/api/v1/health` | `status`, service name, API version; no system details. |
| GET | `/api/v1/ready` | Both model and explanation resources initialized. |
| GET | `/api/v1/models/heart-disease` | Algorithm, dataset, feature names, labels, artifact fingerprint, saved threshold, research status, historical aggregate metrics, and limitations. |
| GET | `/api/v1/models/heart-disease/schema` | Form-ready labels, types, options, units, required/null flags, support ranges, and imputation policy. |
| POST | `/api/v1/predict/heart-disease` | One predicted class, uncalibrated class-1 score, saved threshold, and disclaimer. |
| POST | `/api/v1/explain/heart-disease` | The same prediction plus one record's additive log-odds explanation. |

Interactive documentation is at [Swagger UI](http://127.0.0.1:8000/docs),
[ReDoc](http://127.0.0.1:8000/redoc), and
[OpenAPI JSON](http://127.0.0.1:8000/openapi.json) while the server runs locally.
All six endpoints have documented output schemas; inference bodies share the same
strict `HeartRecord` and errors use `ErrorResponse`.

## Input contract

Every key below is required. Each value may explicitly be `null`, which is passed
to the already-fitted imputer rather than silently replaced by zero. An entirely
null record is rejected. Category values must be JSON integers, without string,
boolean, or fractional coercion. Measurements must be finite JSON numbers.

| Field | Type when non-null | Supported values / units |
| --- | --- | --- |
| `age` | Number | 29-77 years |
| `sex` | Integer | 0 female, 1 male, as recorded in the UCI source |
| `cp` | Integer | 1 typical angina, 2 atypical angina, 3 non-anginal pain, 4 asymptomatic |
| `trestbps` | Number | 94-200 mm Hg |
| `chol` | Number | 126-564 mg/dL |
| `fbs` | Integer | 0 false, 1 true for the source's fasting-glucose-above-120 indicator |
| `restecg` | Integer | 0 normal, 1 ST-T abnormality, 2 probable/definite LV hypertrophy |
| `thalach` | Number | 71-202 beats/min |
| `exang` | Integer | 0 no, 1 yes |
| `oldpeak` | Number | 0-6.2; UCI documentation does not specify units |
| `slope` | Integer | 1 upsloping, 2 flat, 3 downsloping |
| `ca` | Integer | 0, 1, 2, or 3 vessels visualized |
| `thal` | Integer | 3 normal, 6 fixed defect, 7 reversible defect |

The numeric intervals are **observed training minima/maxima**, used as a transparent
support policy for this prototype. They are not medical normal ranges, disease
cutoffs, or proof of physiological plausibility. Some legitimate observations
outside this cohort's range are therefore deliberately unsupported. Startup
compares this contract with the actual training partition so it cannot silently
drift. Changing that policy requires a reviewed schema change, not a claim of
clinical validation.

Missing keys, extra fields (including identifiers/targets), nested values, lists,
unknown categories, non-finite values, numeric strings/booleans, and unsupported
ranges are rejected. The existing original feature order is enforced during
DataFrame conversion. No alternate encoding, scaling, or imputation is implemented.

## Example request and actual observed response

The following is a **fabricated demonstration input**, not a real patient record.
The response below was obtained from the running API, not hardcoded by the server.

```json
{"age":55,"sex":1,"cp":4,"trestbps":140,"chol":240,"fbs":0,"restecg":0,"thalach":150,"exang":0,"oldpeak":1.0,"slope":2,"ca":0,"thal":3}
```

Actual response:

```json
{
  "model": "heart-disease-logistic-regression",
  "prediction": {
    "class_id": 1,
    "class_label": "Recorded heart disease present",
    "positive_class_score": 0.5591060693708545,
    "threshold": 0.5,
    "score_semantics": "uncalibrated_experimental_model_score"
  },
  "disclaimer": "Experimental research output. Not a medical diagnosis or clinically calibrated risk estimate."
}
```

The score exactly matched direct `pipeline.predict_proba` on the same feature
record during live verification. It is not a clinical disease probability.

For the same body, `/api/v1/explain/heart-disease` returned 28 contributions in
the fitted order, a 242-row background, `positive-class log-odds` units, and a
maximum reconstruction error of **6.6613e-16**. Original values are echoed only in
that explanation response; no request is persisted or logged by the application.

The explanation baseline is fixed by the training background, not the submitted
record. Positive/negative contributions describe this model's departure from that
baseline. The response includes original-variable/category mapping, transformed
values, top three positive and negative terms, and the reconstructed decision value.
Applying sigmoid recovers the model score. Log-odds contributions are not probability
changes or disease causes. No image or global 61-row SHAP array is returned.

## Error contract

Every application error uses this shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "details": [
      {"field":"cp","code":"unknown_category","message":"Use a documented UCI category or null."}
    ]
  }
}
```

That example is the actual response to a demonstration request with unsupported
`cp=99`. Submitted values, unknown field names, Pydantic input/context objects,
internal paths, exception strings, and stack traces are excluded.

| Status | Meaning |
| --- | --- |
| 400 | Malformed JSON, invalid length header, denied CORS preflight, or malformed request. |
| 404 / 405 | Unknown endpoint or unsupported method, using the same envelope. |
| 413 | Declared or actual streamed body exceeds the byte limit. |
| 415 | Body is not `application/json`, or compressed request encoding is unsupported. |
| 422 | Missing/extra fields, wrong type, unsupported category/range, non-finite value, wrong shape, or entirely null record. |
| 500 | Unexpected failure; details are suppressed. |
| 503 | Model or explanation service unavailable; no internal paths are returned. |

Liveness remains 200 if resource loading fails. Readiness is 503 until both model
and explanation services are initialized. If only SHAP initialization fails,
prediction remains available to direct callers, while readiness and explanation
return 503. Resources are not silently reloaded, retrained, or downloaded; repair
the local bundle/configuration and restart. Startup logs report only sanitized
failure categories, not exception text or filesystem paths.

HTTP-server protocol rejections before a request reaches ASGI are outside the
application error envelope. There is no streaming-response endpoint; unexpected
failures before response start receive the safe 500 envelope.

## Lifecycle, concurrency, and privacy

Lifespan loads the trusted model once and builds one SHAP engine from training
rows. Synchronous routes run in FastAPI's worker thread pool. A shared reentrant
lock serializes prediction and explanation use of the frozen model within each
process; this favors a simple, deterministic local research service over maximum
throughput. Each additional Uvicorn worker would have its own model/background;
the verified command uses one process. No expensive global SHAP calculation or
disk read occurs per request.

Default controls:

- Bind only `127.0.0.1`. Do not use a public host binding for this prototype.
- Explicit CORS origins: localhost and 127.0.0.1 on ports 5173 and 3000. Credentials
  are disabled; wildcard origins are rejected even if credentials are enabled.
- CORS is a browser policy, **not authentication**; non-browser clients can still
  call a reachable server. Disallowed preflight failures use safe JSON.
- Request-body limit: **16,384 bytes**, checked before and during buffering, even
  with absent or incorrect `Content-Length`. No uploads/compressed bodies are supported.
- Strict single-record JSON and no patient identifier fields.
- `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, and no-referrer headers
  on application responses. No clinical request-body logging or persistence.
- Documented startup disables Uvicorn access logs, avoiding URL/query logging as
  well. Keep debug/trace logging disabled in other infrastructure.

This is not a security/compliance certification. There is no authentication,
authorization, TLS termination, rate limiting, audit platform, or clinical-data
retention system. Before any real clinical use, access controls, consent/legal
basis, privacy/security review, infrastructure hardening, monitoring, incident
response, bias/generalization review, external validation, and applicable regulatory
assessment would be required. Do not submit real patient information here.

## Configuration, installation, and reproduction

Pinned/tested backend dependencies are FastAPI 0.115.14, Pydantic 2.11.7,
Pydantic Settings 2.10.1, Uvicorn 0.34.3, HTTPX 0.28.1, and Starlette 0.46.2.
The previous model/SHAP package versions are unchanged. Both direct requirements
and transitive constraints were updated consistently.

From the repository root in PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m pip check
python -m pytest -q
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

Use Ctrl+C to stop a foreground server. If port 8000 already hosts this backend,
use the existing process rather than starting another instance. Uvicorn `--reload`
is optional for development, but each restart rebuilds in-memory resources; never
use it as a substitute for model versioning or clinical validation.

Settings may be supplied by `MEDINTEL_PROJECT_ROOT`, `MEDINTEL_CORS_ORIGINS` (JSON
array), `MEDINTEL_CORS_ALLOW_CREDENTIALS`, and `MEDINTEL_MAX_REQUEST_BYTES`. The
optional `.env` file is ignored by Git; `.env.example` contains development values
only. Changing project root must point to the owner's complete trusted serving bundle.

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/health'
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/ready'
Invoke-RestMethod 'http://127.0.0.1:8000/api/v1/models/heart-disease/schema'
$body = @{
    age = 55; sex = 1; cp = 4; trestbps = 140; chol = 240
    fbs = 0; restecg = 0; thalach = 150; exang = 0; oldpeak = 1.0
    slope = 2; ca = 0; thal = 3
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/v1/predict/heart-disease' -ContentType 'application/json' -Body $body
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/v1/explain/heart-disease' -ContentType 'application/json' -Body $body
```

## Actual verification results

The complete suite passed **97 tests**, preserving all prior tests. Coverage includes
model/prediction equivalence, ordering, null imputation, repeatability, no per-request
reloads, strict validation, SHAP alignment/additivity, streamed limits, CORS, error/log
privacy, startup failures, once-only model loading, and no fit calls. `pip check`
reported no broken requirements. One upstream Starlette/AnyIO `BlockingPortal`
deprecation warning remains in TestClient; it is not a test failure and is not suppressed.

The live Uvicorn server returned 200 for health, readiness, metadata, form schema,
Swagger, ReDoc, and OpenAPI. A valid prediction and a 28-feature SHAP explanation
succeeded. Invalid categories returned 422 and malformed JSON returned 400. Model
scores matched direct pipeline scores. Detailed actual checks are saved locally in
`reports/metrics/backend_verification.json`, covered by the existing ignore rules.

Measured loopback HTTP observations, with 20 sequential requests per endpoint
after 5 warmups using a reused connection and one Uvicorn process:

| Endpoint | Median | Observed p95 |
| --- | --- | --- |
| Prediction | 26.28 ms | 33.48 ms |
| Individual explanation | 88.80 ms | 134.67 ms |

These are a small local smoke sample, not a production, hardware-independent, or
concurrent-load benchmark. They include local HTTP/request validation/serialization
overhead and do not establish throughput guarantees.

The artifact fingerprint remains unchanged. Notebooks 01-04, source data, original
`src/` modules, Phase 3/4 metrics, and prior phase documentation are preserved.
The backend contains no frontend, database, authentication platform, additional
disease model, cloud deployment, or training implementation.

Phase 6 can consume the shared schema and JSON endpoints after approval. It must
retain the uncalibrated-score labels, experimental disclaimers, and validation/error
states. Phase 5 stops here.
