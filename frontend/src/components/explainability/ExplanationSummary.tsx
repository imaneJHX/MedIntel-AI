import type { ExplanationResponse } from "../../types/api";
export function ExplanationSummary({
  result,
}: {
  result: ExplanationResponse;
}) {
  const explanation = result.explanation;
  return (
    <>
      <section className="explanation-stats">
        <div className="panel">
          <p className="eyebrow">SHAP BASELINE</p>
          <strong>{explanation.baseline_log_odds.toFixed(5)}</strong>
          <span>Positive-class log-odds</span>
        </div>
        <div className="panel">
          <p className="eyebrow">MODEL OUTPUT</p>
          <strong>{explanation.model_output_log_odds.toFixed(5)}</strong>
          <span>Baseline + all 28 contributions</span>
        </div>
        <div className="panel">
          <p className="eyebrow">RECONSTRUCTION ERROR</p>
          <strong>
            {explanation.max_reconstruction_error.toExponential(2)}
          </strong>
          <span>Numerical consistency check</span>
        </div>
      </section>
      <div className="contributor-grid">
        {(
          [
            {
              title: "Largest upward contributions",
              items: explanation.top_positive_contributors,
              direction: "positive",
            },
            {
              title: "Largest downward contributions",
              items: explanation.top_negative_contributors,
              direction: "negative",
            },
          ] as const
        ).map((group) => (
          <section className="panel" key={group.title}>
            <h3>{group.title}</h3>
            {group.items.length === 0 && (
              <p>No contributions in this direction.</p>
            )}
            <ul className="contributor-list">
              {group.items.map((item) => (
                <li key={item.feature}>
                  <span>{item.feature}</span>
                  <strong className={group.direction}>
                    {item.contribution_log_odds > 0 ? "+" : ""}
                    {item.contribution_log_odds.toFixed(4)}
                  </strong>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <section className="panel interpretation">
        <h2>How to read this explanation</h2>
        <p>
          Positive SHAP values increase the model’s positive-class output
          relative to its baseline. Negative values decrease it. SHAP reflects
          model behavior and does not establish medical causation.
        </p>
        <p>
          The baseline uses {explanation.background_records} training
          observations. Contributions are measured in log-odds and are not
          changes in disease probability. Encoded categories can contribute even
          when their transformed value is zero. Independent masking does not
          preserve feature correlations.
        </p>
        <p className="muted small">{explanation.interpretation}</p>
        <details>
          <summary>View the submitted research inputs</summary>
          <dl className="key-values">
            {Object.entries(explanation.input_values).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value === null ? "Unknown · imputed" : value}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>
    </>
  );
}
