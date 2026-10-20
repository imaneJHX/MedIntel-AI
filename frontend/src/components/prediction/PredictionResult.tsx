import { ArrowRight, CheckCheck, CircleDashed } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useResearch } from "../../hooks/ResearchContext";
import { Disclaimer } from "../ui/Disclaimer";
import { explanationPath } from "../../utils/workspaces";
export function PredictionResult({ showLink = true }: { showLink?: boolean }) {
  const { prediction: result, stale, busy } = useResearch();
  const location = useLocation();
  if (!result)
    return (
      <section className="panel result-empty" aria-label="Prediction result">
        <span className="empty-icon">
          <CircleDashed size={31} />
        </span>
        <p className="eyebrow">READY WHEN YOU ARE</p>
        <h2>An output with context.</h2>
        <p>
          Enter the research inputs and run a prediction. Your experimental
          score and classification will appear here.
        </p>
        <div className="empty-step">
          <span>1</span>Provide the 13 research features
        </div>
        <div className="empty-step">
          <span>2</span>Review the model output
        </div>
        <div className="empty-step">
          <span>3</span>Explore the SHAP explanation
        </div>
      </section>
    );
  const { prediction } = result;
  return (
    <section
      className={`panel result-card ${stale ? "stale" : ""}`}
      aria-label="Prediction result"
      aria-live="polite"
      aria-busy={busy !== null}
    >
      <div className="section-title">
        <p className="eyebrow">EXPERIMENTAL OUTPUT</p>
        <CheckCheck size={20} className="teal" />
      </div>
      {stale && (
        <div className="stale-warning" role="status">
          Inputs changed. This previous result no longer corresponds to the
          current inputs. Run a new prediction.
        </div>
      )}
      <span className="tag neutral">CLASS {prediction.class_id}</span>
      <h2>{prediction.class_label}</h2>
      <p className="muted">
        The model classified this research observation as matching recorded{" "}
        {prediction.class_id === 1 ? "presence" : "absence"} in the historical
        dataset.
      </p>
      <div className="score-box">
        <span>Positive-class score</span>
        <strong>{prediction.positive_class_score.toFixed(4)}</strong>
        <div className="score-track" aria-hidden="true">
          <span
            style={{ width: `${prediction.positive_class_score * 100}%` }}
          />
        </div>
        <p>
          Experimental model score — not a clinically calibrated disease risk.
        </p>
      </div>
      <dl className="key-values">
        <div>
          <dt>Classification threshold</dt>
          <dd>{prediction.threshold.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Class rule</dt>
          <dd>Score &gt; threshold → 1</dd>
        </div>
        <div className="stacked">
          <dt>Model identifier</dt>
          <dd>{result.model}</dd>
        </div>
      </dl>
      {showLink && (
        <Link
          to={explanationPath(location.pathname)}
          className={`button secondary ${stale ? "disabled-link" : ""}`}
          aria-disabled={stale}
          onClick={(event) => {
            if (stale) event.preventDefault();
          }}
        >
          Explain this output <ArrowRight size={16} />
        </Link>
      )}
      <Disclaimer compact />
    </section>
  );
}
