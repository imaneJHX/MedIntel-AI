import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import { useResearch } from "../../hooks/ResearchContext";
import type {
  Draft,
  InputSchema,
  InputField,
  FeatureName,
} from "../../types/api";
import {
  buildFormSchema,
  demoDraft,
  emptyDraft,
  NULL_VALUE,
  toPayload,
} from "../../utils/form";
import { ErrorMessage } from "../ui/ErrorMessage";
import { InfoTooltip } from "../ui/InfoTooltip";

export function PatientForm({
  schema,
  grouped = false,
}: {
  schema: InputSchema;
  grouped?: boolean;
}) {
  const { draft, setDraft, predict, busy, cancel, actionError } = useResearch();
  const validation = useMemo(() => buildFormSchema(schema), [schema]);
  const {
    register,
    handleSubmit,
    getValues,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Draft>({
    resolver: zodResolver(validation),
    defaultValues: draft,
  });
  const values = watch();
  const apply = (next: Draft) => {
    reset(next);
    setDraft(next);
  };
  const renderField = (field: InputField) => {
    const isUnknown = values[field.name] === NULL_VALUE;
    const error = errors[field.name]?.message;
    const hintId = `${field.name}-hint`;
    const errorId = `${field.name}-error`;
    return (
      <div className="form-field" key={field.name}>
        <div className="field-label-row">
          <label htmlFor={field.name}>
            {field.label}
            {field.unit && <span className="field-unit"> · {field.unit}</span>}
          </label>
          {grouped && (
            <InfoTooltip label={field.label} description={field.description} />
          )}
        </div>
        {field.options.length ? (
          <select
            id={field.name}
            {...register(field.name)}
            aria-invalid={!!error}
            aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
          >
            <option value="">Select a category</option>
            {field.options.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label} ({option.value})
              </option>
            ))}
            {field.nullable && (
              <option value={NULL_VALUE}>Unknown — use training imputer</option>
            )}
          </select>
        ) : (
          <>
            <input
              id={field.name}
              type="number"
              step="any"
              min={field.minimum ?? undefined}
              max={field.maximum ?? undefined}
              placeholder={
                isUnknown
                  ? "Unknown — training imputation"
                  : `${field.minimum ?? ""}–${field.maximum ?? ""}`
              }
              {...register(field.name)}
              value={isUnknown ? "" : values[field.name]}
              disabled={isUnknown}
              aria-invalid={!!error}
              aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
            />
            {field.nullable && (
              <label className="unknown-toggle">
                <input
                  type="checkbox"
                  checked={isUnknown}
                  onChange={(event) => {
                    setValue(
                      field.name,
                      event.target.checked ? NULL_VALUE : "",
                      { shouldValidate: true },
                    );
                    setDraft({ ...getValues() });
                  }}
                />
                Unknown (use training imputer)
              </label>
            )}
          </>
        )}
        <p id={hintId} className="field-hint">
          {field.description}
          {!field.options.length &&
            ` Supported: ${field.minimum}–${field.maximum}.`}
        </p>
        {error && (
          <p id={errorId} className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  };
  return (
    <section className="panel form-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">RESEARCH INPUT</p>
          <h2>Observation details</h2>
        </div>
        <span className="tag neutral">13 FEATURES</span>
      </div>
      <p className="muted">
        Use a fabricated demonstration case only. Supported ranges reflect
        training data, not medical normality.
      </p>
      <div className="form-toolbar">
        <button
          type="button"
          className="button secondary small-button"
          onClick={() => apply({ ...demoDraft })}
        >
          <Sparkles size={15} aria-hidden="true" />
          Load fabricated example
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => apply(emptyDraft())}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Clear inputs
        </button>
      </div>
      <form
        noValidate
        onChange={() => setDraft({ ...getValues() })}
        onSubmit={handleSubmit(async (data) => {
          await predict(toPayload(data, schema), { ...data });
        })}
        aria-label="Heart disease research input"
      >
        <div className={grouped ? "clinical-groups" : "form-grid"}>
          {grouped
            ? clinicalGroups.map((group) => (
                <fieldset className="clinical-fieldset" key={group.title}>
                  <legend>{group.title}</legend>
                  <div className="form-grid">
                    {group.fields
                      .map((name) =>
                        schema.fields.find((field) => field.name === name),
                      )
                      .filter((field): field is InputField => !!field)
                      .map(renderField)}
                  </div>
                </fieldset>
              ))
            : schema.fields.map(renderField)}
        </div>
        <div className="form-footer">
          <p>
            All 13 fields must contain a value or an explicit unknown. Blank
            inputs are never converted to zero.
          </p>
          <div className="button-row">
            <button
              className="button primary"
              type="submit"
              disabled={busy !== null}
            >
              {busy === "prediction"
                ? "Running prediction…"
                : "Run research prediction"}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            {busy && (
              <button
                type="button"
                className="button secondary"
                onClick={cancel}
              >
                Cancel request
              </button>
            )}
          </div>
        </div>
      </form>
      {actionError && <ErrorMessage message={actionError} />}
    </section>
  );
}

const clinicalGroups: { title: string; fields: FeatureName[] }[] = [
  { title: "Demographics", fields: ["age", "sex"] },
  { title: "Symptoms and history", fields: ["cp", "exang"] },
  {
    title: "Clinical measurements",
    fields: ["trestbps", "chol", "fbs", "thalach", "oldpeak"],
  },
  {
    title: "Diagnostic test findings",
    fields: ["restecg", "slope", "ca", "thal"],
  },
];
