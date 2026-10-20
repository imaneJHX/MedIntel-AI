import { ArrowRight, ChartNoAxesCombined } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { predictionPath } from "../utils/workspaces";
import { useResearch } from "../hooks/ResearchContext";
import { Disclaimer } from "../components/ui/Disclaimer";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { LoadingState } from "../components/ui/LoadingState";
import { PredictionResult } from "../components/prediction/PredictionResult";
import { ShapContributionChart } from "../components/explainability/ShapContributionChart";
import { ExplanationSummary } from "../components/explainability/ExplanationSummary";
export function ExplainabilityPage() {
  const location = useLocation();
  const { prediction, explanation, explain, stale, busy, cancel, actionError } =
    useResearch();
  return (
    <div className="page space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE THE MODEL VISIBLE</p>
          <h1>Behind the output.</h1>
          <p>
            See how individual features influence this observation’s
            classification.
          </p>
        </div>
      </div>
      <Disclaimer />
      {!prediction ? (
        <section className="panel empty-page">
          <ChartNoAxesCombined size={38} className="teal" />
          <h2>Start with an observation.</h2>
          <p>
            Run a research prediction first. Its validated inputs will be used
            to request a matching SHAP explanation.
          </p>
          <Link
            to={predictionPath(location.pathname)}
            className="button primary"
          >
            Open prediction form <ArrowRight size={16} />
          </Link>
        </section>
      ) : stale ? (
        <section className="panel">
          <div className="stale-warning" role="status">
            Inputs changed. The previous prediction and explanation no longer
            correspond to the current inputs.
          </div>
          <Link
            to={predictionPath(location.pathname)}
            className="button primary"
          >
            Update prediction <ArrowRight size={16} />
          </Link>
        </section>
      ) : (
        <>
          <div className="explain-intro">
            <div className="panel">
              <p className="eyebrow">EXPLAIN THIS OBSERVATION</p>
              <h2>A closer look at the decision.</h2>
              <p>
                Request an individual explanation from the frozen model using
                the exact inputs of your latest successful prediction.
              </p>
              <button
                type="button"
                className="button primary"
                disabled={busy !== null}
                onClick={() => {
                  void explain();
                }}
              >
                {busy === "explanation"
                  ? "Computing explanation…"
                  : explanation
                    ? "Refresh explanation"
                    : "Generate SHAP explanation"}
                <ArrowRight size={16} />
              </button>
              {busy && (
                <button type="button" className="text-button" onClick={cancel}>
                  Cancel request
                </button>
              )}
            </div>
            <PredictionResult showLink={false} />
          </div>
          {busy === "explanation" && (
            <LoadingState label="Computing individual SHAP contributions…" />
          )}
          {actionError && <ErrorMessage message={actionError} />}
          {explanation && (
            <>
              <ExplanationSummary result={explanation} />
              <ShapContributionChart
                contributions={explanation.explanation.feature_contributions}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
