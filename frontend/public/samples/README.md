# Synthetic demonstration documents

These files contain invented measurements and invented document-relative intervals. They have no patient identifiers and are labeled **SYNTHETIC TEST DOCUMENT — NOT A REAL PATIENT REPORT**.

- `synthetic_routine_blood_count.pdf`: hemoglobin, white blood cell count and platelets; below/within/above the printed intervals.
- `synthetic_lipid_panel.pdf`: total/HDL/LDL cholesterol and triglycerides; one-sided bounds and a missing interval.
- `synthetic_glucose_kidney.pdf`: glucose, decimal-comma creatinine, duplicate creatinine rows and an unsupported measurement.
- `synthetic_lipid_panel.png` and `.jpg`: raster versions for local OCR demonstration. They require Tesseract with English language data; no OCR engine or model is downloaded at runtime.

The intervals are test data, not clinical guidance. No medical diagnosis follows from these examples. Generate missing fixtures with `python scripts/create_synthetic_reports.py` from the repository root. The generator preserves already-existing fixture files.
