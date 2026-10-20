import { useEffect, useRef, useState } from "react";
import {
  FileText,
  LoaderCircle,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { api, safeError, ApiError } from "../../services/api";
import type { ReportExtraction } from "../../types/reports";
import { ErrorMessage } from "../ui/ErrorMessage";
import { MeasurementReview } from "./MeasurementReview";

const MAX_BYTES = 5 * 1024 * 1024;
export function validateReportFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mime =
    extension === "pdf"
      ? "application/pdf"
      : extension === "png"
        ? "image/png"
        : ["jpg", "jpeg"].includes(extension ?? "")
          ? "image/jpeg"
          : "";
  if (!mime || file.type !== mime)
    return "Select a PDF, PNG or JPEG with a matching file type.";
  if (file.name.length > 128)
    return "Use a filename of at most 128 characters.";
  if (file.size === 0) return "Select a non-empty file.";
  if (file.size > MAX_BYTES) return "Select a file no larger than 5 MiB.";
  return null;
}
export function ReportUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [report, setReport] = useState<ReportExtraction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [info, setInfo] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const active = useRef<AbortController | null>(null);
  const version = useRef(0);
  useEffect(
    () => () => {
      version.current += 1;
      active.current?.abort();
    },
    [],
  );
  const clear = () => {
    version.current += 1;
    active.current?.abort();
    setBusy(false);
    setFile(null);
    setInfo(null);
    setReport(null);
    setError("");
    setAcknowledged(false);
    if (input.current) input.current.value = "";
  };
  const select = (files: FileList | File[]) => {
    setError("");
    if (files.length !== 1) {
      setFile(null);
      setInfo(null);
      setError("Select exactly one synthetic report.");
      return;
    }
    const selected = files[0],
      problem = validateReportFile(selected);
    if (problem) {
      setFile(null);
      setInfo(null);
      setError(problem);
      return;
    }
    setFile(selected);
    setInfo({ name: selected.name, size: selected.size, type: selected.type });
    setAcknowledged(false);
  };
  const upload = async () => {
    if (!file || !acknowledged) {
      setError(
        "Select a file and acknowledge that it contains no real personal or patient information.",
      );
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    const id = ++version.current;
    setBusy(true);
    setError("");
    try {
      const response = await api.extractReport(file, controller.signal);
      if (version.current !== id) return;
      setReport(response);
      setFile(null);
      if (input.current) input.current.value = "";
    } catch (cause) {
      if (
        version.current === id &&
        !(cause instanceof ApiError && cause.code === "cancelled")
      )
        setError(safeError(cause));
    } finally {
      if (version.current === id) setBusy(false);
    }
  };
  return (
    <div className="space-y-7 report-explorer">
      <aside
        className="report-privacy"
        aria-label="Synthetic document privacy notice"
      >
        <ShieldCheck size={23} />
        <div>
          <strong>
            Synthetic demonstration reports only. Never upload real patient
            documents.
          </strong>
          <p>
            Files are processed locally by this development backend in temporary
            memory. No document, extraction or correction is saved. This is not
            a clinical document service, and acknowledgement cannot guarantee a
            file contains no personal information.
          </p>
        </div>
      </aside>
      <ol className="report-steps" aria-label="Report exploration workflow">
        {["Upload", "Extract", "Review", "Explain"].map((step, index) => (
          <li
            key={step}
            className={
              report
                ? index < 2
                  ? "complete"
                  : "current"
                : busy
                  ? index === 1
                    ? "current"
                    : ""
                  : index === 0
                    ? "current"
                    : ""
            }
          >
            <span>{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      {!report && (
        <section className="panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">STEP 1 · CHOOSE A SYNTHETIC EXAMPLE</p>
              <h2>Upload a demonstration report</h2>
            </div>
            <span className="tag neutral">LOCAL PROCESSING</span>
          </div>
          <p>
            PDF, PNG or JPEG · maximum 5 MiB · up to 5 PDF pages · images up to
            4096 pixels per side and 8 million pixels.
          </p>
          <p className="small">
            The document must visibly include SYNTHETIC TEST DOCUMENT. Text PDFs
            work without OCR. Images and scanned PDFs require a locally
            installed Tesseract engine with English data.
          </p>
          <div
            className={`report-dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!busy) select(event.dataTransfer.files);
            }}
          >
            <UploadCloud size={35} className="teal" aria-hidden="true" />
            <h3>Drop one synthetic report here</h3>
            <p>or choose a file from your computer</p>
            <label htmlFor="synthetic-report-file" className="sr-only">
              Choose synthetic report
            </label>
            <input
              ref={input}
              id="synthetic-report-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              disabled={busy}
              onChange={(event) => {
                if (event.target.files) select(event.target.files);
              }}
            />
          </div>
          {info && (
            <div className="selected-report">
              <FileText size={22} />
              <div>
                <strong>{info.name}</strong>
                <p>
                  {(info.size / 1024).toFixed(1)} KiB · {info.type}
                </p>
              </div>
            </div>
          )}
          <label className="synthetic-ack">
            <input
              type="checkbox"
              disabled={busy}
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            I confirm this is a synthetic demonstration document containing no
            real personal or patient information.
          </label>
          <div className="button-row">
            <button
              type="button"
              className="button primary"
              onClick={() => {
                void upload();
              }}
              disabled={!file || !acknowledged || busy}
            >
              {busy ? (
                <>
                  <LoaderCircle size={17} className="spin" />
                  Uploading and extracting…
                </>
              ) : (
                <>
                  <UploadCloud size={17} />
                  Extract synthetic report
                </>
              )}
            </button>
            {(file || busy) && (
              <button
                type="button"
                className="button secondary"
                onClick={clear}
              >
                <Trash2 size={16} />
                {busy ? "Cancel and clear" : "Clear selection"}
              </button>
            )}
          </div>
          {busy && (
            <p className="extraction-progress" role="status">
              Uploading and extracting locally. This may take up to 40 seconds.
              No progress percentage is estimated.
            </p>
          )}
          {error && <ErrorMessage message={error} />}
          <div className="sample-reports">
            <h3>Start with an identifier-free sample</h3>
            <p>
              Download a sample, then choose it above. Printed intervals are
              invented demonstration data, not medical guidance.
            </p>
            <ul>
              {[
                ["routine_blood_count", "Routine blood count"],
                ["lipid_panel", "Lipid panel"],
                ["glucose_kidney", "Glucose and kidney function"],
              ].map(([name, title]) => (
                <li key={name}>
                  <a
                    className="text-link"
                    href={`/samples/synthetic_${name}.pdf`}
                    download
                  >
                    {title} · PDF
                  </a>
                </li>
              ))}
              <li>
                <a
                  className="text-link"
                  href="/samples/synthetic_lipid_panel.png"
                  download
                >
                  Lipid panel · PNG (requires OCR)
                </a>
              </li>
              <li>
                <a
                  className="text-link"
                  href="/samples/synthetic_lipid_panel.jpg"
                  download
                >
                  Lipid panel · JPEG (requires OCR)
                </a>
              </li>
            </ul>
          </div>
        </section>
      )}
      {report && (
        <>
          <section className="panel processing-summary" aria-live="polite">
            <div>
              <p className="eyebrow">
                EXTRACTION COMPLETE · REVIEW STILL REQUIRED
              </p>
              <h2>{info?.name ?? report.filename}</h2>
              <p>
                {report.page_count} page(s) ·{" "}
                {report.extraction_method === "embedded_text"
                  ? "Embedded PDF text"
                  : report.extraction_method === "local_ocr"
                    ? "Local OCR"
                    : "Mixed embedded text and OCR"}{" "}
                · Server retention: none
              </p>
            </div>
            <button type="button" className="button secondary" onClick={clear}>
              <Trash2 size={16} />
              Clear report
            </button>
          </section>
          <section
            className="panel extraction-warnings"
            aria-label="Extraction warnings"
          >
            <h2>Before reviewing</h2>
            <ul>
              {report.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            <p>{report.disclaimer}</p>
          </section>
          {report.measurements.length ? (
            <MeasurementReview report={report} />
          ) : (
            <section className="panel" role="status">
              <h2>No supported measurements found</h2>
              <p>
                No measurements have been invented. Clear this report and use a
                supplied synthetic example or the documented row layout.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
