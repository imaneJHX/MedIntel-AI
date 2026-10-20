import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Crosshair,
  Database,
  Layers,
  Microscope,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useResearch } from "../hooks/ResearchContext";
import { Disclaimer } from "../components/ui/Disclaimer";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { LoadingState } from "../components/ui/LoadingState";
import { StatCard } from "../components/ui/StatCard";
import { MetricChart } from "../components/ui/MetricChart";
import { study, formatMetric } from "../utils/provenance";
export function DashboardPage() {
  const { metadata, loading, resourceError, retry } = useResearch();
  return (
    <div className="page space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow">A CLEARER VIEW OF THE MODEL</p>
          <h1>Your research, explained.</h1>
          <p>
            Explore heart disease classification with evidence and transparency.
          </p>
        </div>
        <span className="outline-badge">
          <FlaskBadge />
          Research prototype
        </span>
      </div>
      <section className="hero-card">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="tiny-dot" />
            HEART DISEASE RESEARCH
          </div>
          <h2>
            From data to insight.
            <br />
            <span>With the model in view.</span>
          </h2>
          <p>
            A focused workspace to explore experimental predictions, understand
            influential features, and examine the evidence behind each output.
          </p>
          <Link to="/research/predict" className="button primary">
            Explore a prediction <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <span className="hero-footnote">
            Logistic Regression <span aria-hidden="true">·</span> SHAP
            explanations <span aria-hidden="true">·</span> UCI Cleveland
          </span>
        </div>
        <div
          className="pipeline-visual"
          aria-label="Research workflow: 13 input features pass through a frozen pipeline to a class and SHAP explanation"
        >
          <div className="visual-caption">AN OPEN VIEW OF THE PIPELINE</div>
          <div className="pipeline-node">
            <Database size={19} />
            <div>
              <strong>13 research inputs</strong>
              <small>Original UCI features</small>
            </div>
            <span className="node-number">01</span>
          </div>
          <div className="pipeline-connector" />
          <div className="pipeline-node emphasized">
            <Layers size={19} />
            <div>
              <strong>One frozen pipeline</strong>
              <small>Preprocessing + classification</small>
            </div>
            <span className="node-number">02</span>
          </div>
          <div className="pipeline-connector" />
          <div className="pipeline-node">
            <Microscope size={19} />
            <div>
              <strong>An explained output</strong>
              <small>Individual SHAP contributions</small>
            </div>
            <Check size={17} className="teal" />
          </div>
          <div className="visual-bottom">
            <ShieldCheck size={14} />
            Transparent by design. Experimental by scope.
          </div>
        </div>
      </section>
      {loading && <LoadingState label="Loading model evidence…" />}
      {resourceError && <ErrorMessage message={resourceError} retry={retry} />}
      {metadata && (
        <>
          <section
            className="stats-grid"
            aria-label="Historical evaluation highlights"
          >
            <StatCard
              label="Holdout accuracy"
              value={formatMetric(
                metadata.experimental_holdout_metrics.accuracy,
              )}
              detail={`${metadata.evaluation_records} historical test records`}
              icon={Target}
            />
            <StatCard
              label="Recall · class 1"
              value={formatMetric(metadata.experimental_holdout_metrics.recall)}
              detail="Recorded disease presence"
              icon={Crosshair}
            />
            <StatCard
              label="ROC-AUC"
              value={
                metadata.experimental_holdout_metrics.roc_auc?.toFixed(3) ??
                "Unavailable"
              }
              detail="Historical discrimination metric"
              icon={Layers}
            />
            <StatCard
              label="Source dataset"
              value={String(study.records)}
              detail="Historical records, not platform usage"
              icon={Database}
            />
          </section>
          <div className="overview-grid">
            <section className="panel">
              <div className="section-title">
                <div>
                  <p className="eyebrow">THE EVIDENCE</p>
                  <h2>Experimental performance</h2>
                </div>
                <span className="tag neutral">
                  HOLDOUT · {metadata.evaluation_records} RECORDS
                </span>
              </div>
              <p className="muted small">
                A small historical test set. These results do not establish
                clinical validity.
              </p>
              <MetricChart metrics={metadata.experimental_holdout_metrics} />
              <Link to="/research/methodology" className="text-link">
                Review methodology and limitations <ArrowRight size={15} />
              </Link>
            </section>
            <section className="panel model-spotlight">
              <div className="section-title">
                <div>
                  <p className="eyebrow">CURRENT RESEARCH MODULE</p>
                  <h2>Heart disease</h2>
                </div>
                <span className="module-icon">
                  <Microscope size={22} />
                </span>
              </div>
              <div className="model-name">{metadata.algorithm}</div>
              <p className="muted">
                Selected using stratified cross-validation on training data.
              </p>
              <dl className="key-values">
                <div>
                  <dt>Dataset</dt>
                  <dd>UCI Cleveland</dd>
                </div>
                <div>
                  <dt>Original features</dt>
                  <dd>{metadata.input_features.length}</dd>
                </div>
                <div>
                  <dt>Transformed features</dt>
                  <dd>{metadata.transformed_feature_count}</dd>
                </div>
                <div>
                  <dt>Explanation method</dt>
                  <dd>Linear SHAP</dd>
                </div>
              </dl>
              <Link to="/research/methodology" className="button secondary">
                Explore the model <ArrowUpRight size={16} />
              </Link>
            </section>
          </div>
        </>
      )}
      <Disclaimer />
    </div>
  );
}
function FlaskBadge() {
  return <Microscope size={14} aria-hidden="true" />;
}
