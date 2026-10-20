# MedIntel AI — Phase 6 frontend dashboard

**Current status — Phase 7:** The root route now selects Patient, Doctor or Researcher workspaces. The original overview is `/research`; `/predict`, `/model` and `/explainability` redirect to research routes. The existing API client, preprocessing/prediction semantics, cancellation, stale-state checks, charts and research pages are reused. Patient pages have no API integration or upload handling. See [the current multi-workspace guide](multi_role_platform.md) for routes, components, verification and limits. The Phase 6 record below preserves that milestone's architecture and actual test counts; its route descriptions refer to the previous layout.

The dashboard is a local educational research interface to the frozen Phase 5 API. No models were trained, historical experiments changed, or new diseases implemented. No authentication, database, or cloud deployment was added.

## Setup and running

Verified environment: Windows, Node.js 24.15.0, npm 11.12.1, Python 3.12.3. Exact direct dependency versions are in `frontend/package.json`; the complete resolution is in `frontend/package-lock.json`. Use `npm ci` to reproduce it. React 19.3.1, TypeScript 6.0.3, Vite 8.3.4, Tailwind 4.3.3, React Router 7.18.4, Recharts 3.10.1, React Hook Form 7.90.0, Zod 4.6.7, and Vitest 5.0.5 were installed and tested together. Resolver 5.2.2 avoids an optional peer dependency conflict in resolver 6.0.0; dependency resolution was not forced.

From the repository root, start the backend only if it is not already running:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

In another terminal:

```powershell
cd C:\MedIntel-AI\frontend
npm ci
npm run dev
```

Frontend: <http://127.0.0.1:3000>. Swagger: <http://127.0.0.1:8000/docs>. Another local app occupied port 5173, so the dashboard uses 3000 with `--strictPort`. Existing FastAPI CORS settings already allow `http://127.0.0.1:3000` and `http://localhost:3000`; no backend edits or second backend instance were needed. Only the dashboard process was started. Both servers bind to loopback.

Optional configuration:

```powershell
Copy-Item .env.example .env.local
```

Set `VITE_API_BASE_URL=http://127.0.0.1:8000` and restart Vite after changes. The default works without an environment file. `VITE_` variables are public browser build settings, never secrets. `.env.local`, dependency directories, builds, test results, and local preservation manifests are ignored; `.env.example` remains shareable.

## Architecture and important files

| File or directory | Responsibility |
| --- | --- |
| `frontend/src/main.tsx` | Starts React, browser routing, and a safe rendering error boundary. |
| `src/App.tsx` | Defines four routes and a not-found route; loads explainability on demand. |
| `src/components/layout/` | Sidebar branding/navigation, backend status header, responsive drawer, skip link and route focus. |
| `src/hooks/ResearchContext.tsx` | Loads metadata and schema, polls liveness/readiness every 30 seconds, keeps temporary draft/results, cancels obsolete requests and rejects late responses. |
| `src/services/api.ts` | Six typed API methods, runtime response checks, 20-second timeout, cancellation, safe error messages, no credentials or request logging. |
| `src/types/api.ts` | Zod runtime contracts and inferred TypeScript types based on actual OpenAPI and Pydantic models. |
| `src/utils/form.ts` | Builds validation from API ranges/categories, distinguishes blank/zero/unknown, creates the exact 13-field JSON payload. |
| `src/utils/provenance.ts` | Verified historical cohort/split constants absent from API metadata; cites Phase 3 report and preprocessing source. |
| `components/prediction/PatientForm.tsx` | React Hook Form with a Zod resolver, schema labels/options/units, field errors, explicit unknowns, reset and fabricated example. |
| `components/prediction/PredictionResult.tsx` | Recorded-label classification, uncalibrated score, threshold, model identifier, stale warning and explanation link. |
| `components/explainability/` | Individual signed SHAP chart, all-feature table, top contributors, baseline/reconstruction and interpretation. |
| `components/ui/` | Reusable cards, lazy metric plot, error/loading states, research notice and rendering fallback. |
| `src/styles.css` | Tailwind entry, theme tokens and responsive component styling. Uses system fonts with no external font requests. |
| `src/test/fixtures/` | Real API/OpenAPI contract snapshots; prediction and SHAP fixtures use only the fabricated OpenAPI example. Never used as live UI fallbacks. |
| `e2e/dashboard.spec.ts` | Live browser workflows at desktop/tablet/mobile, including keyboard, stale state, errors and screenshots. |
| `scripts/api-smoke.mjs` | Opt-in live six-endpoint, CORS, OpenAPI, prediction and SHAP mathematics checks. |

The browser communicates directly with FastAPI. There is no frontend prediction logic, artifact loading, or replacement scoring model. React state holds one temporary observation and its results. Nothing is sent to third-party analytics, stored in localStorage, or written to a database. The API receives the 13 features when prediction/explanation is requested. Avoid real patient information; this local research app has no production identity or access control.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Overview, connection state, API-reported holdout metrics, verified historical dataset count, model snapshot and quick action. |
| `/predict` | Accessible schema-driven research form and a contextual result card. |
| `/explainability` | Uses the exact inputs from the latest successful prediction for an individual explanation. Requests a new prediction after input edits. |
| `/model` | Dataset, target semantics, preprocessing, train/test split, model selection, holdout results, SHAP method, artifact fingerprint and limitations. |

Dataset count 303 and split 242/61 are historical study metadata, not application usage. The API supplies metrics and model metadata. Split seed 42, five CV folds, and preprocessing descriptions were verified against `reports/metrics/experiment.json`, `src/train.py` and `src/preprocessing.py`; they are documented constants, not inferred from the test cohort. Earlier EDA examined the full cohort; the holdout is not an independent external validation dataset.

## API contracts and error behavior

| Method | Endpoint | Frontend usage |
| --- | --- | --- |
| GET | `/api/v1/health` | Liveness; distinguishes an offline API from degraded readiness. |
| GET | `/api/v1/ready` | Requires the model and explainer to be initialized. |
| GET | `/api/v1/models/heart-disease` | Algorithm, metrics, labels, threshold, limitations and artifact SHA. |
| GET | `/api/v1/models/heart-disease/schema` | All input names, descriptions, categories, units, null rules and training-support limits. |
| POST | `/api/v1/predict/heart-disease` | Direct object with all 13 numeric or explicit-null keys. |
| POST | `/api/v1/explain/heart-disease` | The same captured record; returns the prediction and 28 encoded contributions. |

`thal` is the original thallium-test result, not a thalassemia diagnosis. Numeric limits are observed training minima/maxima, not clinical normality. All keys are required; explicit nulls use frozen training-fitted imputation. All-null records are rejected. Blank strings are validation errors, never numeric zero. Category options come from the API; no category interpretations are invented.

The client checks every successful response with Zod. Unexpected formats, malformed JSON, unavailable services, validation failures, network failures and timeouts produce controlled messages. Raw response text, stack traces and submitted values never appear in error notifications. Requests omit credentials, disable HTTP caching, support cancellation, and have a 20-second timeout. A generation counter prevents late replies from replacing results after edits or cancellation. Any edited draft marks the previous result stale; explanations are unavailable until a matching prediction succeeds. Navigating between pages preserves the draft; refresh clears it.

SHAP bars are individual contributions in **positive-class log-odds**, not probability changes. Teal means an increase relative to baseline; purple means a decrease. Rankings are computed from that API response, never copied from global Phase 4 rankings. A full accessible table includes all 28 transformed values and signed contributions. Independent masking ignores correlations and encoded-category exclusivity. Neither SHAP associations nor dataset classifications establish medical causation or clinical validity.

## Reproducible checks

```powershell
cd C:\MedIntel-AI\frontend
npm run type-check
npm run lint
npm test
npm run build
# Existing backend must be running:
npm run test:integration
# Both servers and Microsoft Edge must be running/installed:
npm run test:browser

cd C:\MedIntel-AI
.\.venv\Scripts\python.exe -m pytest -q
```

Unit tests are independent of live services and cover contracts, payload conversion, missing values, categories and ranges, navigation, model/dashboard rendering, status, request failures/cancellation/timeout, loading, disclaimers, result staleness, and late-response rejection. Browser tests use Playwright with installed Edge at 1440×1000, 768×1024 and 390×844. Each live workflow also runs Axe WCAG A/AA checks on all four pages, checks page overflow and console errors, and verifies keyboard access to the skip link. The mobile drawer hides closed navigation from keyboard access, traps focus when open, and supports Escape. Reports and synthetic-example screenshots live in ignored `frontend/test-results/` and `frontend/playwright-report/`. Do not use trace/screenshot recording with private data.

## Actual milestone verification

| Check | Observed result |
| --- | --- |
| TypeScript | Passed, no type errors. |
| ESLint | Passed, zero errors or warnings. |
| Vitest / React Testing Library | 34 passed across 3 files; no live backend dependency. |
| Playwright / Microsoft Edge | 6 passed: live workflow and controlled offline scenario at each of 3 widths. |
| Axe | No detected WCAG A/AA violations on the four pages at the tested widths/states. This is an automated check, not a complete accessibility certification. |
| Browser console | No errors or warnings during successful live workflows. Deliberately aborted API requests in offline tests produce expected browser network errors. |
| Production build | Passed; split JS chunks approximately 428.81 kB entry, 356.81 kB shared chart, 12.29 kB explainability and 0.81 kB metric plot; no oversized-chunk warning. |
| API smoke | All 6 endpoints, OpenAPI and existing CORS preflight passed. |
| Python regression | 97 passed, 1 existing upstream Starlette/AnyIO deprecation warning. No Python dependencies changed. |
| Preservation | All 40 protected files have identical SHA-256 hashes, including dataset, frozen model, all 4 notebooks, Python source/backend files and previous metrics. |
| npm dependency audit during final install | 0 reported vulnerabilities; package versions and lockfile saved. |

The fabricated example produced class **1**, label **Recorded heart disease present**, and positive-class score **0.5591060693708545**. Prediction and explanation endpoints returned the same score. The explanation contained **28 contributions** in positive-class log-odds. Reconstructing baseline plus contributions differed from the reported model output by **5.551115123125783e-16** in the standalone smoke check. This is a numerical check on a fabricated observation, not a clinical finding or a new evaluation metric.

Initially, port 5173 served an unrelated existing app. It was left untouched, and MedIntel was started on port 3000. Browser checks also identified initial skip-link focus, contrast and scrollable-table focus issues; these were corrected before the passing final runs. Playwright prints an environment `NO_COLOR`/`FORCE_COLOR` warning; it is a runner environment message, not a browser application error.

`npm run build` creates the static `frontend/dist/` output. Explanation and chart code is split into separate chunks. `npm run preview` defaults to port 4173 for inspecting the build; that origin is intentionally absent from backend CORS. For a full built-app local check, stop the dev server and use `npm run preview -- --port 3000`. Any future static server must route unknown page paths to `index.html` for React Router. No static server or cloud deployment is added here.

## Limits and next phase

Only the heart disease research module exists. No authentication, database, patient history, model retraining, new datasets, multi-disease comparisons, clinical recommendations or deployment are implemented. Backend status refreshes every 30 seconds and on manual refresh, so it is a recent observation rather than a continuous availability guarantee. The local API remains the source of truth for validation and serving. This dashboard is not a clinical device.

Phase 7 can add disease-specific contracts and modules after approval. Each future dataset and model needs separate provenance, validation, evaluation and explanation semantics. Outputs from different datasets must not be treated as comparable risk probabilities. Phase 6 stops here.

Official implementation references: [Vite guide](https://vite.dev/guide/), [React Hook Form Zod resolver](https://github.com/react-hook-form/resolvers), and [Recharts accessibility](https://github.com/recharts/recharts/blob/main/storybook/stories/API/Accessibility.mdx).
