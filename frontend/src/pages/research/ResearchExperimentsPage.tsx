import { Link } from "react-router-dom";
import { study } from "../../utils/provenance";
import { Disclaimer } from "../../components/ui/Disclaimer";
export function ResearchExperimentsPage() {
  return (
    <div className="page space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow">REPRODUCIBILITY BEFORE EXPANSION</p>
          <h1>The experiment record.</h1>
          <p>A read-only view of the existing heart disease research design.</p>
        </div>
      </div>
      <section className="panel experiment-record">
        <span className="tag">COMPLETED HISTORICAL EXPERIMENT</span>
        <h2>UCI Cleveland · recorded disease classification</h2>
        <dl className="key-values">
          <div>
            <dt>Source observations</dt>
            <dd>{study.records}</dd>
          </div>
          <div>
            <dt>Training / holdout</dt>
            <dd>
              {study.train} / {study.test}
            </dd>
          </div>
          <div>
            <dt>Split seed</dt>
            <dd>{study.seed}</dd>
          </div>
          <div>
            <dt>Cross-validation</dt>
            <dd>{study.folds} stratified folds · training only</dd>
          </div>
          <div>
            <dt>Decision threshold</dt>
            <dd>0.5 · fixed before holdout evaluation</dd>
          </div>
        </dl>
        <p>
          Every validation fold fits its own preprocessing pipeline on its
          training subset. The final pipeline was fitted on the full training
          split, then evaluated on the held-out records.
        </p>
        <p>
          Earlier exploration examined the full cohort. This holdout is not
          independent external validation. No new experiments, threshold tuning
          or model training run from this interface.
        </p>
        <div className="button-row">
          <Link to="/research/models" className="button secondary">
            Compare model results
          </Link>
          <Link to="/research/methodology" className="button secondary">
            Read full methodology
          </Link>
        </div>
      </section>
      <section className="panel">
        <h2>Preparing a future experiment</h2>
        <p>
          A later phase would need a documented question, dataset provenance, a
          leakage-aware split, predetermined selection rules and an independent
          evaluation plan. Existing scores cannot justify a new clinical claim.
        </p>
        <p className="muted small">
          Verified source: reports/metrics/experiment.json and
          docs/model_training.md. This page summarizes the preserved run; it
          does not create an experiment or registry entry.
        </p>
      </section>
      <Disclaimer />
    </div>
  );
}
