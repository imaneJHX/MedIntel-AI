import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { ReportExplanation } from "./ReportExplanation";
import type { Measurement, ReportExtraction } from "../../types/reports";
import { comparisonLabels } from "../../types/reports";
import {
  reviewValues,
  toReviewDraft,
  validateReview,
  type ReviewDraft,
} from "../../utils/reportReview";
type RowState = { draft: ReviewDraft; confirmed: boolean; showError: boolean };
export function MeasurementReview({ report }: { report: ReportExtraction }) {
  const [states, setStates] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      report.measurements.map((row) => [
        row.id,
        { draft: toReviewDraft(row), confirmed: false, showError: false },
      ]),
    ),
  );
  const update = (id: string, patch: Partial<RowState>) =>
    setStates((previous) => ({
      ...previous,
      [id]: { ...previous[id], ...patch },
    }));
  const edit = (id: string, patch: Partial<ReviewDraft>) =>
    update(id, {
      draft: { ...states[id].draft, ...patch },
      confirmed: false,
      showError: false,
    });
  const edited = (row: Measurement) =>
    JSON.stringify(states[row.id].draft) !== JSON.stringify(toReviewDraft(row));
  const confirmed = report.measurements.filter(
    (row) => states[row.id].confirmed,
  );
  return (
    <>
      <section className="panel extraction-review">
        <div className="section-title">
          <div>
            <p className="eyebrow">STEP 3 · CHECK THE TRANSCRIPTION</p>
            <h2>Review extracted measurements</h2>
          </div>
          <span className="tag neutral">
            {confirmed.length} / {report.measurements.length} REVIEWED
          </span>
        </div>
        <p>
          Compare every result, decimal separator, unit and bound with your
          synthetic original. Confirmation means transcription review, not
          clinical verification. Editing any field resets its confirmation.
        </p>
        <div
          className="table-scroll"
          role="region"
          aria-label="Editable laboratory measurements"
          tabIndex={0}
        >
          <table className="review-table">
            <caption>
              Editable synthetic measurements · all rows initially require
              review
            </caption>
            <thead>
              <tr>
                <th>Measurement</th>
                <th>Result and unit</th>
                <th>Reported interval</th>
                <th>Comparison and review</th>
              </tr>
            </thead>
            <tbody>
              {report.measurements.map((row, index) => {
                const state = states[row.id],
                  values = reviewValues(state.draft),
                  error = validateReview(state.draft),
                  changed = edited(row);
                const prefix = `Measurement ${index + 1}`;
                return (
                  <tr key={row.id} id={`review-${row.id}`}>
                    <td>
                      <label htmlFor={`${row.id}-name`}>{prefix} name</label>
                      <input
                        id={`${row.id}-name`}
                        value={state.draft.name}
                        maxLength={80}
                        onChange={(event) =>
                          edit(row.id, { name: event.target.value })
                        }
                      />
                      <span className="review-origin">
                        Original label: {row.original_label}
                      </span>
                      <details className="source-snippet">
                        <summary>Original extraction</summary>
                        <p>{row.source_text}</p>
                        <p>
                          Extracted result: {row.value ?? "Uncertain"}{" "}
                          {row.unit ?? "(unit missing)"}
                        </p>
                        <p>
                          Printed interval:{" "}
                          {row.reference_range?.raw_text ??
                            "Reference interval not provided."}
                        </p>
                        <p>
                          Confidence: not estimated.{" "}
                          {row.extraction_status === "ambiguous"
                            ? "Extraction flagged for review."
                            : "Parsed row; manual review still required."}
                        </p>
                      </details>
                    </td>
                    <td>
                      <label htmlFor={`${row.id}-value`}>{prefix} result</label>
                      <input
                        id={`${row.id}-value`}
                        inputMode="decimal"
                        value={state.draft.value}
                        placeholder="Unknown"
                        onChange={(event) =>
                          edit(row.id, { value: event.target.value })
                        }
                      />
                      <label htmlFor={`${row.id}-unit`}>{prefix} unit</label>
                      <input
                        id={`${row.id}-unit`}
                        value={state.draft.unit}
                        maxLength={40}
                        placeholder="Unit not provided"
                        onChange={(event) =>
                          edit(row.id, { unit: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <div className="bounds-grid">
                        <div>
                          <label htmlFor={`${row.id}-lower`}>
                            {prefix} lower bound
                          </label>
                          <input
                            id={`${row.id}-lower`}
                            inputMode="decimal"
                            value={state.draft.lower}
                            placeholder="Not provided"
                            onChange={(event) =>
                              edit(row.id, { lower: event.target.value })
                            }
                          />
                          <label className="bound-inclusive">
                            <input
                              type="checkbox"
                              checked={state.draft.lowerInclusive}
                              aria-label={`${prefix} lower bound inclusive`}
                              onChange={(event) =>
                                edit(row.id, {
                                  lowerInclusive: event.target.checked,
                                })
                              }
                            />
                            Inclusive
                          </label>
                        </div>
                        <div>
                          <label htmlFor={`${row.id}-upper`}>
                            {prefix} upper bound
                          </label>
                          <input
                            id={`${row.id}-upper`}
                            inputMode="decimal"
                            value={state.draft.upper}
                            placeholder="Not provided"
                            onChange={(event) =>
                              edit(row.id, { upper: event.target.value })
                            }
                          />
                          <label className="bound-inclusive">
                            <input
                              type="checkbox"
                              checked={state.draft.upperInclusive}
                              aria-label={`${prefix} upper bound inclusive`}
                              onChange={(event) =>
                                edit(row.id, {
                                  upperInclusive: event.target.checked,
                                })
                              }
                            />
                            Inclusive
                          </label>
                        </div>
                      </div>
                      <label htmlFor={`${row.id}-reference-unit`}>
                        {prefix} reference unit
                      </label>
                      <input
                        id={`${row.id}-reference-unit`}
                        value={state.draft.referenceUnit}
                        maxLength={40}
                        placeholder="No unit guessed"
                        onChange={(event) =>
                          edit(row.id, { referenceUnit: event.target.value })
                        }
                      />
                      {values.range === null && (
                        <p className="small">
                          Reference interval not provided.
                        </p>
                      )}
                      {values.unit &&
                        values.range?.unit &&
                        values.unit.toLowerCase() !==
                          values.range.unit.toLowerCase() && (
                          <p className="small">
                            Different units: no comparison or conversion.
                          </p>
                        )}
                    </td>
                    <td>
                      <span className={`comparison-label ${values.comparison}`}>
                        {comparisonLabels[values.comparison]}
                      </span>
                      <p className="review-origin">
                        {state.confirmed
                          ? "Transcription reviewed"
                          : "Needs review"}{" "}
                        · {changed ? "Manually edited" : "Original extraction"}
                      </p>
                      {row.warnings.length > 0 && (
                        <ul className="row-warnings">
                          {row.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      )}
                      {state.showError && error && (
                        <p role="alert" className="field-error">
                          {error}
                        </p>
                      )}
                      <div className="review-actions">
                        <button
                          type="button"
                          className="button secondary small-button"
                          disabled={state.confirmed}
                          onClick={() =>
                            update(row.id, {
                              confirmed: !error,
                              showError: true,
                            })
                          }
                        >
                          <Check size={14} />
                          {state.confirmed
                            ? "Reviewed"
                            : "Confirm transcription"}
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          aria-label={`Reset ${prefix.toLowerCase()}`}
                          onClick={() =>
                            update(row.id, {
                              draft: toReviewDraft(row),
                              confirmed: false,
                              showError: false,
                            })
                          }
                        >
                          <RotateCcw size={14} />
                          Reset
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="document-relative-note">
          These labels compare a transcription only with its printed interval.
          They are not diagnoses or clinical assessments. Missing or
          incompatible units and ambiguous bounds remain not evaluated.
        </p>
      </section>
      <ReportExplanation
        key={JSON.stringify(states)}
        total={report.measurements.length}
        measurements={confirmed.map((row) => {
          const values = reviewValues(states[row.id].draft);
          return {
            id: row.id,
            name: states[row.id].draft.name.trim(),
            value: values.value,
            unit: values.unit,
            reference_range: values.range,
            reviewed: true,
            user_corrected: edited(row),
          };
        })}
      />
      <section className="panel report-understand">
        <p className="eyebrow">EDUCATIONAL TERM REFERENCE</p>
        <h2>General educational explanations</h2>
        {confirmed.length === 0 ? (
          <p>
            Confirm a transcription to display a general explanation of its
            supported measurement name.
          </p>
        ) : (
          <div className="education-grid">
            {confirmed.map((row) => {
              const item = report.education.find(
                (entry) =>
                  entry.name.toLowerCase() ===
                  states[row.id].draft.name.trim().toLowerCase(),
              );
              return (
                <article key={row.id}>
                  <h3>{states[row.id].draft.name}</h3>
                  {item ? (
                    <>
                      <p>{item.explanation}</p>
                      <a
                        className="text-link"
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Source: NLM MedlinePlus
                      </a>
                    </>
                  ) : (
                    <p>
                      No educational definition is available for this corrected
                      name. No interpretation has been generated.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
