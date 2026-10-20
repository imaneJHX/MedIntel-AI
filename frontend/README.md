# MedIntel AI multi-workspace frontend

Local React platform with Patient, Doctor and Researcher workspaces. Experimental outputs are not diagnoses or clinically calibrated disease risk. Workspace selection is demonstration navigation, not authentication.

```powershell
cd C:\MedIntel-AI\frontend
npm ci
# Optional: copy .env.example to .env.local and edit the API URL.
npm run dev
```

Open <http://127.0.0.1:3000>. FastAPI must be running separately at <http://127.0.0.1:8000>. Port 3000 is already in the backend CORS allowlist; port 5173 was occupied during implementation. No backend configuration was changed.

The landing page lets visitors choose `/patient`, `/doctor` or `/research`. Patient education pages make no automatic API calls. The Medical Report Explorer at `/patient/reports` calls the local extraction endpoint only after a file is selected, synthetic-only acknowledgement is checked, and **Extract synthetic report** is clicked. It supports PDF/PNG/JPEG up to 5 MiB, editable transcriptions, printed-interval comparisons, per-row confirmation, general educational definitions and clearing. The report workflow never calls heart disease prediction or SHAP.

Doctor and Researcher reuse the existing prediction and explanation services; use **Load fabricated example** to explore them. Fields start blank. Explicit unknowns become JSON `null`; blanks fail validation. Temporary analysis inputs/outputs are shared between those workspaces and clear on refresh or when visiting Patient/the landing page. Reports and corrections are local component state; leaving the report route or clearing removes them. Nothing uses localStorage/sessionStorage.

Download supplied synthetic PDFs from the explorer, then select one above. OCR integration is implemented for image/scanned documents but **Tesseract is currently absent**; these formats display a setup error until the engine and English data are installed. Text PDFs remain functional. No fake OCR results or confidence scores are used.

Legacy `/predict`, `/model` and `/explainability` routes redirect to `/research/predict`, `/research/methodology` and `/research/explainability`. The original research overview is now `/research`.

```powershell
npm run type-check
npm run lint
npm test
npm run build
npm run test:integration
npm run test:provenance
npm run test:browser
```

Unit tests mock the API with captured, validated contracts and do not need a server. Integration checks need FastAPI; browser tests need both servers and an installed Microsoft Edge. Provenance verification needs the original local Phase 3 experiment JSON and CV summary; it checks hashes and all three model rows without writing reports. Browser screenshots and reports are ignored by Git. Use `npx playwright show-report` to inspect the report locally.

`npm run preview` serves the built files on port 4173 for build inspection. That origin is not in the existing backend CORS allowlist. To exercise API features with built files locally, use `npm run preview -- --port 3000` after stopping the dev server. Static hosting must support an SPA fallback for React Router routes; no hosting or deployment is configured here.

Phase 9 extends the sequence to **Upload → Extract → Review → Explain**. After confirming a transcription, use **Explain My Report** to receive offline template-generated summaries, neutral counts, source-linked measurement cards, questions and limitations. English, French and Arabic explanations are supported, with RTL Arabic output and isolated values/units. The application shell remains English. No language model is configured or used.

The new typed `api.explainReport` sends only reviewed structured facts to `POST /api/v1/reports/explain`. Unreviewed rows are explicitly excluded. Zod checks the response schema and a second check matches its facts against the request. Language switches regenerate text without uploading or OCR or changing corrections. Edits, resets and confirmation changes remount the explanation component, abort pending requests and discard old output. Clear Report, route exit and refresh clear all temporary report state. No measurement/explanation state uses storage or analytics.

See [the Phase 9 guide](../docs/medical_report_explanations.md) for engine architecture, source verification, contracts, validation and current tests, and [the Phase 8 guide](../docs/medical_document_extraction.md) for extraction and Windows OCR setup. [Phase 7](../docs/multi_role_platform.md) and [Phase 6](../docs/frontend_dashboard.md) retain earlier milestone records. Accounts, production medical document use, clinical validation and deployment remain unimplemented. Phase 10 has not started. On Windows machines that block `npm.ps1`, use `npm.cmd` for the commands above.
