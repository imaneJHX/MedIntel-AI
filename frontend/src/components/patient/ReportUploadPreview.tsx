import { FileText, LockKeyhole, UploadCloud } from "lucide-react";
export function ReportUploadPreview() {
  return (
    <section
      className="panel report-preview"
      aria-labelledby="report-preview-title"
    >
      <div className="section-title">
        <div>
          <p className="eyebrow">FUTURE CAPABILITY · DESIGN PREVIEW</p>
          <h2 id="report-preview-title">Understand a medical report</h2>
        </div>
        <span className="tag neutral">NOT AVAILABLE YET</span>
      </div>
      <p>
        A preview of how demonstration report exploration could look in a later
        phase.
      </p>
      <div className="upload-preview">
        <span className="upload-icon">
          <UploadCloud size={33} aria-hidden="true" />
        </span>
        <h3>Document upload is not enabled</h3>
        <p>Coming in Phase 8 — Demonstration documents only.</p>
        <button type="button" className="button secondary" disabled>
          <LockKeyhole size={15} />
          Upload unavailable
        </button>
        <p className="small">
          Planned formats: demonstration PDF, PNG and JPG files. No formats are
          accepted in this phase.
        </p>
      </div>
      <div className="preview-privacy">
        <LockKeyhole size={17} />
        <p>
          No file selector, drag-and-drop processing, storage, or transmission
          is implemented. Do not submit real medical documents.
        </p>
      </div>
      <div className="future-result">
        <span className="tag neutral">
          FABRICATED DISPLAY EXAMPLE · NOT EXTRACTED
        </span>
        <div className="future-result-title">
          <FileText size={18} />
          <h3>Example of a future information card</h3>
        </div>
        <dl className="key-values">
          <div>
            <dt>Term</dt>
            <dd>Hemoglobin</dd>
          </div>
          <div>
            <dt>Meaning</dt>
            <dd>Protein that carries oxygen</dd>
          </div>
          <div>
            <dt>Reference range</dt>
            <dd>Would need the source laboratory’s range</dd>
          </div>
        </dl>
        <p>
          A future tool could help explain a term and suggest questions. No
          report has been read, measurements extracted, or diagnosis generated.
        </p>
      </div>
    </section>
  );
}
