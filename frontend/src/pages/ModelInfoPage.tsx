import {
  ArrowUpRight,
  BookOpen,
  Database,
  GitBranch,
  Layers,
} from "lucide-react";
import { useResearch } from "../hooks/ResearchContext";
import { Disclaimer } from "../components/ui/Disclaimer";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { MetricChart } from "../components/ui/MetricChart";
import { metricLabels, study } from "../utils/provenance";
export function ModelInfoPage() {
  const { metadata: model, loading, resourceError, retry } = useResearch();
  return (
    <div className="page space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DOCUMENTED, NOT A BLACK BOX</p>
          <h1>Know the model.</h1>
          <p>
            The data, methodology, evidence, and boundaries behind this module.
          </p>
        </div>
      </div>
      {loading && <LoadingState />}
      {resourceError && <ErrorMessage message={resourceError} retry={retry} />}
      {model && (
        <>
          <section className="panel model-banner">
            <span className="large-module-icon">
              <BookOpen size={29} />
            </span>
            <div>
              <p className="eyebrow">SELECTED TABULAR CLASSIFIER</p>
              <h2>{model.algorithm}</h2>
              <p className="muted">{model.model}</p>
            </div>
            <span className="tag">FROZEN RESEARCH PIPELINE</span>
          </section>
          <div className="model-grid">
            <section className="panel">
              <h2>
                <Database size={20} />
                Dataset and target
              </h2>
              <p>{model.dataset}</p>
              <dl className="key-values">
                <div>
                  <dt>Historical observations</dt>
                  <dd>{study.records}</dd>
                </div>
                <div>
                  <dt>Original input features</dt>
                  <dd>{model.input_features.length}</dd>
                </div>
                <div>
                  <dt>Training / test records</dt>
                  <dd>
                    {study.train} / {study.test}
                  </dd>
                </div>
                <div>
                  <dt>Split</dt>
                  <dd>Stratified 80/20 · seed {study.seed}</dd>
                </div>
              </dl>
              <p>
                Target 0 means recorded absence. Original labels 1–4 become
                class 1: recorded presence. This is classification of a
                historical label, not prediction of future disease onset.
              </p>
              <a
                className="text-link"
                href={model.dataset_url}
                target="_blank"
                rel="noreferrer"
              >
                Official UCI source <ArrowUpRight size={15} />
              </a>
              <p className="small muted">
                Counts and split: {study.source}. Dataset: DOI 10.24432/C52P4X,
                CC BY 4.0.
              </p>
            </section>
            <section className="panel">
              <h2>
                <Layers size={20} />
                Preprocessing and explanation
              </h2>
              <ol className="method-list">
                <li>
                  <strong>Numeric measurements</strong>
                  <p>
                    Training-fitted median imputation, then standard scaling.
                  </p>
                </li>
                <li>
                  <strong>Coded categories</strong>
                  <p>
                    Training-fitted most-frequent imputation, then one-hot
                    encoding.
                  </p>
                </li>
                <li>
                  <strong>Frozen prediction pipeline</strong>
                  <p>
                    {model.input_features.length} original inputs become{" "}
                    {model.transformed_feature_count} encoded features.
                    Threshold: {model.threshold}.
                  </p>
                </li>
                <li>
                  <strong>Independent Linear SHAP</strong>
                  <p>
                    A fixed {study.train}-record training background explains
                    positive-class log-odds. Associations do not imply
                    causation.
                  </p>
                </li>
              </ol>
            </section>
          </div>
          <section className="panel">
            <h2>
              <GitBranch size={20} />
              Evaluation methodology
            </h2>
            <p>
              Logistic Regression, Random Forest, and XGBoost were compared
              using {study.folds}-fold stratified cross-validation on training
              data. Preprocessing remained inside each fold. Selection
              prioritized recall among models meeting mean precision ≥ 0.60,
              then F1 and ROC-AUC. The selected model was evaluated on{" "}
              {model.evaluation_records} held-out records at a fixed threshold.
            </p>
            <div className="model-grid">
              <MetricChart metrics={model.experimental_holdout_metrics} />
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Historical metric details"
              >
                <table>
                  <caption>
                    Historical holdout results · {model.evaluation_records}{" "}
                    records
                  </caption>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(metricLabels)
                      .filter(
                        ([key]) =>
                          model.experimental_holdout_metrics[key] !== undefined,
                      )
                      .map(([key, label]) => (
                        <tr key={key}>
                          <th scope="row">{label}</th>
                          <td>
                            {model.experimental_holdout_metrics[key].toFixed(4)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <p className="small muted">
                  API-reported historical results. Brier score measures squared
                  error; lower is better. A small holdout produces uncertain
                  estimates. No external clinical validation or clinical
                  calibration has been established.
                </p>
              </div>
            </div>
          </section>
          <section className="panel limitations">
            <p className="eyebrow">BOUNDARIES OF THE EVIDENCE</p>
            <h2>Known limitations</h2>
            <ul>
              {model.limitations.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
              <li>
                The small historical cohort may not represent current
                populations or care settings.
              </li>
              <li>
                SHAP independent masking ignores feature correlations and the
                mutual exclusivity of encoded categories.
              </li>
              <li>
                Numeric input limits reflect training support, not medically
                normal values.
              </li>
            </ul>
            <details>
              <summary>Artifact provenance</summary>
              <p className="small break-all">
                SHA-256: {model.artifact_sha256}
              </p>
            </details>
          </section>
        </>
      )}
      <Disclaimer />
    </div>
  );
}
