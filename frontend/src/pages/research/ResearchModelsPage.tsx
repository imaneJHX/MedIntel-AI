import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import comparison from "../../data/researchComparison.json";
import { Disclaimer } from "../../components/ui/Disclaimer";
import { MetricChart } from "../../components/ui/MetricChart";
import { useResearch } from "../../hooks/ResearchContext";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { LoadingState } from "../../components/ui/LoadingState";
const metrics = ["accuracy", "precision", "recall", "f1", "roc_auc"] as const;
const labels = {
  accuracy: "Accuracy",
  precision: "Precision",
  recall: "Recall",
  f1: "F1",
  roc_auc: "ROC-AUC",
};
export function ResearchModelsPage() {
  const { metadata, loading, resourceError, retry } = useResearch();
  return (
    <div className="page space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow">FROZEN PHASE 3 EXPERIMENT</p>
          <h1>Compare the research models.</h1>
          <p>
            Training-only cross-validation results from the original experiment.
          </p>
        </div>
      </div>
      <section className="panel">
        <div className="section-title">
          <h2>Five-fold stratified cross-validation</h2>
          <span className="tag neutral">242 TRAINING RECORDS</span>
        </div>
        <p>
          Values show mean ± sample standard deviation across the same five
          validation folds. Fold standard deviation is not a confidence
          interval. These are historical results, not new training runs.
        </p>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Cross-validation comparison"
        >
          <table>
            <caption>
              Historical training-only comparison · mean ± sample SD
            </caption>
            <thead>
              <tr>
                <th>Model</th>
                {metrics.map((metric) => (
                  <th key={metric}>{labels[metric]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.models.map((model) => (
                <tr key={model.model}>
                  <th scope="row">
                    {model.model}
                    {model.model === "Logistic Regression" && (
                      <span className="selected-model">Selected</span>
                    )}
                  </th>
                  {metrics.map((metric) => (
                    <td key={metric}>
                      {model[`${metric}_mean`].toFixed(3)} ±{" "}
                      {model[`${metric}_std`].toFixed(3)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Source: {comparison.source}. Summary values verified against the
          immutable experiment manifest. SHA-256:{" "}
          <span className="break-all">{comparison.source_sha256}</span>
        </p>
        <p>
          Selection prioritized mean recall among candidates with mean precision
          ≥ 0.60, then F1 and ROC-AUC. Logistic Regression was selected using
          training data. Only that selected model received final holdout
          evaluation.
        </p>
      </section>
      <div className="model-grid">
        <section className="panel">
          <h2>Selected model · held-out evaluation</h2>
          <p>
            The following chart uses the API’s historical results on 61 held-out
            records. Do not compare these values directly to the
            cross-validation table as if they used the same evaluation records.
          </p>
          {loading && (
            <LoadingState label="Loading historical holdout metrics…" />
          )}
          {resourceError && (
            <ErrorMessage message={resourceError} retry={retry} />
          )}
          {metadata && (
            <MetricChart metrics={metadata.experimental_holdout_metrics} />
          )}
        </section>
        <section className="panel">
          <h2>What the comparison can tell us</h2>
          <p>
            These configurations provide a linear baseline, an ensemble of trees
            and a boosted-tree candidate. The experiment supports a reproducible
            choice within this small dataset.
          </p>
          <p>
            It does not demonstrate clinical validity or establish that one
            algorithm is universally better. No held-out results were generated
            for the alternative models.
          </p>
          <Link className="text-link" to="/research/experiments">
            Inspect the experiment design
            <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <Disclaimer />
    </div>
  );
}
