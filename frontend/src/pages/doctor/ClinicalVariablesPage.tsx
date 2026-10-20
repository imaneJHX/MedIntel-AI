import { useResearch } from "../../hooks/ResearchContext";
import { Disclaimer } from "../../components/ui/Disclaimer";
import { LoadingState } from "../../components/ui/LoadingState";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
export function ClinicalVariablesPage() {
  const { schema, loading, resourceError, retry } = useResearch();
  return (
    <div className="page space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ORIGINAL UCI FEATURE DEFINITIONS</p>
          <h1>Clinical variable reference</h1>
          <p>Definitions supplied by the existing backend input schema.</p>
        </div>
      </div>
      {loading && <LoadingState label="Loading variable definitions…" />}
      {resourceError && <ErrorMessage message={resourceError} retry={retry} />}
      {schema && (
        <>
          <section className="panel">
            <h2>Supported inputs, with context</h2>
            <p>{schema.numeric_range_semantics}</p>
            <p>{schema.missing_value_policy}</p>
          </section>
          <div className="variable-grid">
            {schema.fields.map((field) => (
              <article className="panel variable-card" key={field.name}>
                <span className="tag neutral">{field.name}</span>
                <h2>{field.label}</h2>
                <p>{field.description}</p>
                <dl className="key-values">
                  <div>
                    <dt>Unit</dt>
                    <dd>{field.unit ?? "Not specified in the schema"}</dd>
                  </div>
                  <div>
                    <dt>Explicit unknown</dt>
                    <dd>
                      {field.nullable
                        ? "Allowed · training-fitted imputation"
                        : "Not allowed"}
                    </dd>
                  </div>
                </dl>
                {field.options.length ? (
                  <ul className="category-reference">
                    {field.options.map((option) => (
                      <li key={option.value}>
                        <code>{option.value}</code>
                        {option.label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    <strong>Training support:</strong> {field.minimum}–
                    {field.maximum} {field.unit}
                  </p>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      <Disclaimer />
    </div>
  );
}
