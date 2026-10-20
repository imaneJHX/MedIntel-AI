# MedIntel AI — Phase 8 synthetic Medical Report Explorer

**Current Phase 9 extension:** the existing extraction/parser/OCR services and schemas remain unchanged. Reviewed structured measurements can now be submitted to `/api/v1/reports/explain` for offline English, French and Arabic educational explanations. No LLM is used. The current workflow is Upload → Extract → Review → Explain; the Phase 8 verification below remains historical. See [Medical report explanations](medical_report_explanations.md) for the new API, tests and state behavior. Tesseract is still absent, and Phase 9 does not depend on OCR. Phase 10 requires approval.

Phase 8 adds a local, synthetic-only workflow: **Upload → Extract → Review → Understand** at <http://127.0.0.1:3000/patient/reports>. It does not diagnose conditions, generate disease predictions, assign clinical risk, recommend treatment, or connect uploaded reports to the heart disease classifier.

**OCR status on the implementation machine:** Tesseract is absent from PATH and the two checked Windows installation locations. Embedded-text PDF extraction is working and was verified with real requests and browser uploads. Image and scanned-PDF handling is implemented, but currently returns an explicit `ocr_unavailable` response. Decoding/rendering plus OCR orchestration are tested with mocked OCR; this is not a claim that a real OCR engine ran successfully.

## Audit and baseline

The audit inspected FastAPI initialization/router registration, privacy middleware, errors/settings, existing schemas and tests, Patient routes and preview, typed client, React test infrastructure, dependencies and documentation. Existing frontend/backend instances were reused. Baseline suites were executed before application changes: **97 Python tests**, **51 frontend tests**, **15 browser tests** passed. Python retained one existing upstream Starlette/AnyIO deprecation warning.

Research preservation hashes cover 25 pre-existing files: the four notebooks, Python research modules, dataset, pipeline and historical report artifacts. Backend initialization/configuration/middleware required additive changes; they are not falsely described as byte-identical. Original six OpenAPI path contracts and all original component schemas are compared exactly, and regression checks preserve their inference behavior. No model fitting, dataset changes, historical metric edits, SHAP changes, accounts, database, deployment or Git publication occurred.

## Architecture and major files

| File | Responsibility |
| --- | --- |
| `app/api/routes/medical_reports.py` | Independent multipart endpoint; parses the bounded form and dispatches CPU work off the API event loop. No model-service dependency. |
| `app/schemas/medical_reports.py` | Finite, bounded response models for measurements, intervals, warnings, provenance snippets and general education. |
| `app/services/report_multipart.py` | Exactly one file plus acknowledgement, parsed directly into memory without Starlette's disk-spooling UploadFile path. |
| `app/services/document_validation.py` | Signature/type/extension consistency, bytes, single-frame image decoding, dimensions and pixel limits. |
| `app/services/document_extraction.py` | Embedded text via pypdf, bounded raster rendering via PDFium and local Tesseract subprocess using binary stdin/plain-text stdout. |
| `app/services/laboratory_parser.py` | Conservative deterministic row matching, numeric parsing, explicit printed bounds, duplicate preservation and document-relative comparisons. |
| `app/services/laboratory_education.py` | Fixed NLM-sourced definitions; no individual result interpretation. |
| `app/services/report_processing.py` | One active document per API process, short-lived worker, time limit and Windows process-tree resource job. |
| `app/services/report_worker.py` | Reads bounded bytes from stdin and returns bounded validated JSON; suppresses document/library logging. |
| `app/services/report_errors.py` | Fixed public document errors, separate from internal exceptions and uploaded values. |
| `app/core/security.py` | Retains JSON limits; only the exact report POST accepts bounded multipart. Adds body read timeout and a fail-fast upload gate. |
| `app/main.py`, `app/core/config.py` | Register the seventh router, initialize the independent report service and expose bounded settings. |
| `frontend/src/components/patient/ReportUpload.tsx` | Selection/drop, client checks, acknowledgement, explicit submission, indeterminate progress, cancellation, error handling, samples and clear action. |
| `frontend/src/components/patient/MeasurementReview.tsx` | Editable rows, original extraction, correction labels, per-row confirmation/reset and post-review educational cards. |
| `frontend/src/types/reports.ts` | Runtime Zod validation and TypeScript response types derived from the implemented backend. |
| `frontend/src/utils/reportReview.ts` | Validate corrections and recompute printed-bound comparisons locally without unit conversions or medical thresholds. |
| `frontend/src/services/api.ts` | Extends the existing client with multipart support, a 60-second report timeout and allowlisted, sanitized document error messages. |
| `scripts/create_synthetic_reports.py` | Generates missing synthetic PDF/PNG/JPEG examples; preserves existing fixtures. |
| `frontend/public/samples/` | Three identifier-free PDFs and raster OCR examples, visibly marked synthetic. |
| `tests/test_medical_reports.py` | New backend extraction, parser, security, worker lifecycle and compatibility checks. |
| `frontend/src/components/patient/ReportUpload.test.tsx`, `frontend/src/utils/reportReview.test.ts` | Upload, review, failure, cancellation, numeric/bound and clearing tests using an actual synthetic API fixture. |
| `frontend/e2e/reports.spec.ts` | Real local uploads, manual review, edits, reset/clear, accessibility and honest missing-OCR behavior at all three widths. |

The previous preview component is retained as historical source but is not mounted. Existing Patient navigation now says **Report explorer**. Doctor and Researcher routes and research components remain available. Existing tests were retained and updated where they specifically expected the disabled Phase 7 preview or a total of only six API paths.

## Installation and local execution

Existing packages remain at their prior versions. Added pinned packages: `pypdf==6.21.1`, `pypdfium2==5.14.0`, and `python-multipart==0.0.32`. Existing `pillow==13.0.0` is now an explicit direct requirement. No frontend package was added. The Python constraints file includes the new versions.

```powershell
cd C:\MedIntel-AI
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe scripts/create_synthetic_reports.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

```powershell
cd C:\MedIntel-AI\frontend
npm ci
npm run dev
```

Check for existing instances first. The tracked backend was restarted once to load Phase 8 after verifying its project interpreter and Uvicorn command line; no second backend remains running. The existing frontend dev server was reused. URLs are localhost only: frontend port 3000, backend/Swagger port 8000. No public deployment is configured.

### Optional Windows Tesseract setup

The engine and English language data are separate from Python dependencies. Follow the [official Tesseract installation guide](https://tesseract-ocr.github.io/tessdoc/Installation.html), which links Windows installers maintained by UB Mannheim. Install a suitable local Tesseract 5 build with `eng` language data. Nothing is downloaded automatically by MedIntel at runtime.

Verify installation in PowerShell:

```powershell
& 'C:\Program Files\Tesseract-OCR\tesseract.exe' --version
& 'C:\Program Files\Tesseract-OCR\tesseract.exe' --list-langs
```

The language list must include `eng`. The app checks PATH, `C:\Program Files\Tesseract-OCR\tesseract.exe`, and the equivalent x86 location. For another location, set an absolute path in the optional ignored project `.env`:

```text
MEDINTEL_TESSERACT_COMMAND=C:/Your/Install/Directory/tesseract.exe
```

Restart FastAPI after environment/configuration changes. The app invokes fixed arguments `stdin stdout -l eng --psm 6`; it does not accept OCR flags or executable paths from uploads. Direct CLI streaming is used instead of pytesseract's temporary-file pathway. English-only OCR and the supported synthetic layouts still require manual review. No performance/accuracy guarantee is made after installation.

## Endpoint and response contract

**POST `/api/v1/reports/extract`**, `multipart/form-data`:

| Field | Requirement |
| --- | --- |
| `file` | Exactly one PDF, PNG, JPG or JPEG file with matching extension, MIME and signature. |
| `synthetic_only` | Literal form value `true`, acknowledging no real personal or patient information. |

Every accepted document must visibly contain **SYNTHETIC TEST DOCUMENT**. The marker and acknowledgement do not prove that private data has been removed. They narrow the demonstration scope and do not replace authentication, privacy controls or a production review.

Swagger's multipart form documents both fields. Example with curl.exe:

```powershell
curl.exe -X POST 'http://127.0.0.1:8000/api/v1/reports/extract' `
  -F 'synthetic_only=true' `
  -F 'file=@frontend/public/samples/synthetic_routine_blood_count.pdf;type=application/pdf'
```

Top-level response: `document_type`, generic `filename`, `page_count`, `extraction_method`, `measurements`, `education`, `warnings`, `retained:false`, and a disclaimer. The original filename is not echoed by the API; the browser can show its own local selection name.

Each measurement includes `id`, standardized `name`/`analyte`, `original_label`, finite `value` or null, `unit` or null, `reference_range` or null, bounded `source_text`, `extraction_confidence:null`, `extraction_status`, document-relative `status`, `review_required:true`, and warnings. Intervals carry lower/upper bounds, inclusive/exclusive flags, unit and original notation. Education is a fixed supported-analyte catalog with source URLs. No full extracted document text is returned.

Excerpt from the real synthetic blood-count response, with other response fields omitted for readability:

```json
{
  "document_type": "synthetic_laboratory_report",
  "filename": "synthetic-report.pdf",
  "page_count": 1,
  "extraction_method": "embedded_text",
  "measurements": [
    {
      "id": "measurement-1",
      "analyte": "hemoglobin",
      "name": "Hemoglobin",
      "value": 11.2,
      "unit": "g/dL",
      "reference_range": {
        "lower": 12.0,
        "upper": 16.0,
        "lower_inclusive": true,
        "upper_inclusive": true,
        "unit": "g/dL",
        "raw_text": "12.0 - 16.0"
      },
      "source_text": "Hemoglobin | 11.2 | g/dL | 12.0 - 16.0",
      "extraction_confidence": null,
      "status": "below_reported_interval",
      "review_required": true
    }
  ],
  "retained": false
}
```

Errors use the existing safe JSON envelope. Examples: 400 malformed form/missing acknowledgement; 413 byte/page/pixel/text limits; 415 mismatched or unsupported format; 422 malformed/encrypted/unmarked document; 408 upload/OCR/worker deadline; 429 active document; 503 unavailable OCR or resource-limited worker. Error text does not contain filenames, document values, stack traces or internal paths. Valid marked documents with no recognized rows return an empty list and an explicit warning, never invented measurements.

## Extraction and processing limits

| Limit | Implemented behavior |
| --- | --- |
| Upload | 5 MiB (5,242,880 bytes) by default; multipart envelope has an additional 64 KiB allowance. Actual bytes are counted, including misleading/missing Content-Length. |
| Existing inference JSON | Retains the original 16 KiB default. Multipart is accepted only on the exact report POST route. |
| Upload time | At most 15 seconds waiting for a chunk and 20 seconds overall body read. |
| PDFs | At most five pages; encrypted, interactive/action/form/embedded-file PDFs rejected. No PDF JavaScript execution or arbitrary filename paths. |
| Images | Single-frame PNG/JPEG, decoder verification, maximum side 4096 and total eight million pixels; decompression-bomb warnings are errors. |
| Rendering | Bounded page geometry; at most 2× PDF scale, reduced for pixel/dimension limits; one page at a time, no form/annotation drawing. |
| PDF decoding | Context-local pypdf stream/work limits, 8 MiB decompression caps, 2 MiB page content cap and bounded page-tree/work traversal; total worker memory/time additionally constrained. |
| Text | At most 50,000 characters; at most 50 supported rows, 240-character source snippets and bounded warnings/JSON response. |
| OCR | Fixed English Tesseract command, grayscale/orientation handling only, default eight-second timeout per page; no digit repair or unit conversion. |
| Worker | Default 40-second total wall time. Windows Job Object: 512 MiB aggregate memory, two processes maximum, kill worker/OCR tree on job close. Fails closed if this resource boundary cannot be established. |
| Concurrency | One active upload/extraction per API process; additional reports fail fast, not an unbounded queue. Default documented Uvicorn runs one worker. |

On non-Windows, worker address-space limits and process-group termination are implemented, but this milestone was verified on Windows, not certified across platforms. Python/library/OS overhead is still relevant; the limits support a local demonstration and are not production capacity claims.

Settings in `.env.example`: `MEDINTEL_REPORT_MAX_BYTES`, `MEDINTEL_REPORT_MAX_PAGES`, `MEDINTEL_REPORT_TIMEOUT_SECONDS`, `MEDINTEL_REPORT_OCR_TIMEOUT_SECONDS`, and optional `MEDINTEL_TESSERACT_COMMAND`. File/page settings may tighten the documented maximum; they cannot raise it. The UI displays the maximum supported contract, so a deployment that tightens limits may reject a smaller document with a controlled limit error.

## Parser scope and manual verification

Supported names/abbreviations: hemoglobin/HGB/Hb, glucose/GLU, total cholesterol/TC, HDL, LDL, triglycerides/TG, white blood cell count/WBC, platelets/PLT and creatinine/CREAT. The limited layouts use one row per measurement:

```text
Hemoglobin | 11.2 | g/dL | 12.0 - 16.0
Glucose    105    mg/dL    70 - 110
Creatinine 1,4 mg/dL 0,6 - 1,2
```

Unambiguous decimal commas with one/two fractional digits are supported. A token such as `1,234` could mean a grouped integer and is not guessed. Split decimals, OCR letter substitutions, scientific-notation results, complex multi-line tables and unsupported labels remain ambiguous or unparsed. Units are kept, not numerically converted. Missing units are not inferred. A range without a separate unit uses the row's unit under the documented single-row layout; an explicitly different range unit prevents comparison.

Supported printed bounds include `12 - 16`, `< 200`, `<= 200`, `> 40`, `>= 40`, `≤` and `≥`. Missing intervals say **Reference interval not provided.** Ambiguous bounds or incompatible units remain **Not evaluated**. Other labels are **Below reported interval**, **Within reported interval**, and **Above reported interval**. These labels describe only the printed interval and are never interpreted as a disease or health status.

Duplicate analytes remain separate rows with distinct source snippets and review warnings. Confidence is always null because no calibrated extraction confidence is available. Unsupported lines generate warnings rather than fabricated output. Partial extraction is possible: the interface does not claim that every report row was found.

All rows initially need review. Users can edit name, value, unit, bounds, reference unit and inclusive flags. Original extraction stays available in each row. Corrections are finite/non-negative decimal-point numbers or explicit unknown blanks; reversed ranges are rejected. Editing resets confirmation, recomputes only the document-relative comparison, and labels the row manually edited. Reset restores that row's original extraction and removes confirmation. Confirmed means **transcription reviewed**, not clinically verified. A general supported-term definition becomes available after confirmation; it does not depend on the result value. Unknown corrected names do not receive an invented definition.

**Clear report** removes the file selection, extracted rows, corrections, confirmations, warnings and acknowledgement from page state. Leaving the report route or refreshing also clears them and cancels the client request. Cancellation cannot guarantee server work has not already begun; server work remains bounded and is not persisted. No secure RAM zeroization claim is made.

## Privacy and educational sources

The service binds to localhost. CORS remains an explicit local-origin allowlist, not authentication. There are no patient accounts, secure patient storage, clinical authorization, malware scanning, healthcare compliance certification or regulatory validation. Never use real patient documents. The application reads uploads into bounded memory and passes bytes over anonymous subprocess pipes; it does not create uploaded-file paths, temporary OCR files, database records, request-body logs, localStorage/sessionStorage entries or external OCR/LLM calls. pypdfium2/Tesseract can read installed libraries/fonts/language data; this is process resource isolation, not a production filesystem security sandbox.

Only limited recognized row snippets are returned for active-session verification. API responses are `no-store`; unexpected errors suppress details. Static synthetic fixtures are intentionally shareable; their invented reference intervals are not medical guidance. Existing development runtime logs and Matplotlib startup caches contain no uploaded document content and are distinct from document storage.

General definitions cite NLM MedlinePlus: [Hemoglobin](https://medlineplus.gov/lab-tests/hemoglobin-test/), [Glucose](https://medlineplus.gov/lab-tests/blood-glucose-test/), [Cholesterol and triglycerides](https://medlineplus.gov/lab-tests/cholesterol-levels/), [White blood count](https://medlineplus.gov/lab-tests/white-blood-count-wbc/), [Platelets](https://medlineplus.gov/lab-tests/platelet-tests/), and [Creatinine](https://medlineplus.gov/lab-tests/creatinine-test/). These definitions are fixed text; no medical explanation is generated from a personal result.

## Tests and actual verification

```powershell
cd C:\MedIntel-AI
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m pip check

cd frontend
npm run type-check
npm run lint
npm test
npm run build
npm run test:integration
npm run test:provenance
npm run test:browser
```

Executed final results: **145 Python tests passed** (97 previous + 48 new), with the same one upstream deprecation warning; **73 frontend tests passed** (51 previous + 22 new); **21 browser tests passed** (15 previous/adapted + 6 new) across desktop, tablet and mobile. TypeScript, ESLint, formatting and production build passed. All three live synthetic PDF examples returned HTTP 200 with the expected rows, including decimal commas, duplicate labels and a missing interval. Real PNG upload returned the expected HTTP 503 `ocr_unavailable`; it did not fabricate OCR output. The six previous paths and component contracts match exactly, all 25 protected research artifacts retain their SHA-256 hashes, and existing API/metric provenance smoke checks passed. Local verification is recorded in `reports/metrics/medical_document_verification.json`.

Backend tests include real synthetic text PDFs, actual PNG/JPEG decoding, scanned-PDF rendering with mocked OCR, explicit missing OCR, fixed CLI streaming/timeout, malformed/encrypted/oversized/empty files, page/pixel limits, decimal handling, mismatched/missing units, bounds, duplicates, no invented rows, process cleanup/slot release, no temporary upload files and API compatibility. Frontend tests cover selection/drop, limits, acknowledgement, multipart contract, indeterminate progress, cancellation/late replies, success/empty/error states, edits, review reset, comparisons, education and clearing without persistence.

Browser tests use the actual local endpoint, three viewport widths, synthetic fixtures, accessible controls/tables, Axe WCAG A/AA checks, and no console errors on successful PDF workflows. OCR-unavailable scenarios deliberately exercise an HTTP error and are not mislabeled as successful OCR. No real OCR accuracy or production throughput benchmark is claimed. Automated accessibility checks do not constitute a complete certification.

## Limits and Phase 9 suggestions

The deterministic parser deliberately supports a small, English-language family of synthetic layouts. OCR can alter numbers/units, some rows can be missed, and manual confirmation does not establish truth or medical validity. No external reference ranges are substituted. Tesseract remains an optional missing system dependency on this machine.

After separate approval, Phase 9 could evaluate real local OCR on a versioned synthetic corpus, expand supported layouts with precision/recall benchmarks, strengthen tests for ambiguous decimal/table alignment, and improve review ergonomics. Any production handling of medical information would first require real authentication/authorization, secure storage and deletion design, privacy/security review and applicable regulatory assessment. No Phase 9 implementation, public deployment, commit or push occurred.

Technical references: [pypdf text extraction](https://pypdf.readthedocs.io/en/stable/user/extract-text.html), [pypdfium2 process/thread guidance](https://pypdfium2.readthedocs.io/en/stable/python_api.html), [python-multipart](https://multipart.fastapiexpert.com/), and [Tesseract CLI](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html).
