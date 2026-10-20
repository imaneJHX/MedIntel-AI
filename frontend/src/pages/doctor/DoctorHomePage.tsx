import {
  ArrowRight,
  ClipboardList,
  Microscope,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useResearch } from "../../hooks/ResearchContext";
import { Disclaimer } from "../../components/ui/Disclaimer";
import { LoadingState } from "../../components/ui/LoadingState";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
export function DoctorHomePage() {
  const { metadata, loading, resourceError, retry, status } = useResearch();
  return (
    <div className="page space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow">STRUCTURED EXPLORATION · FABRICATED CASES</p>
          <h1>Clinical Research Workspace</h1>
          <p>
            Explore structured clinical demonstration data and interpretable
            machine learning outputs.
          </p>
        </div>
        <span className="outline-badge">DEMONSTRATION INTERFACE</span>
      </div>
      <div className="workspace-access-notice" role="note">
        This is a demonstration interface, not an authenticated clinical portal.
        Workspace selection does not verify professional credentials or grant
        access to patient records.
      </div>
      <section className="clinical-hero panel">
        <span className="large-module-icon">
          <ClipboardList size={29} />
        </span>
        <div>
          <p className="eyebrow">A CONTROLLED RESEARCH WORKFLOW</p>
          <h2>Review the inputs. Examine the output.</h2>
          <p>
            Use a fabricated observation to explore the frozen UCI research
            model. Keep case context and experimental limitations in view.
          </p>
          <Link to="/doctor/cases" className="button primary">
            Explore a demonstration case
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <div className="clinical-cards">
        <article className="panel">
          <SlidersHorizontal size={24} className="teal" />
          <h2>Clinical variable reference</h2>
          <p>
            Review source-defined categories, units, training-support limits and
            missing-value rules.
          </p>
          <Link to="/doctor/clinical-variables" className="text-link">
            Review all 13 variables
            <ArrowRight size={15} />
          </Link>
        </article>
        <article className="panel">
          <Microscope size={24} className="teal" />
          <h2>Research model availability</h2>
          {loading && <LoadingState label="Loading model availability…" />}
          {resourceError && (
            <ErrorMessage message={resourceError} retry={retry} />
          )}
          {metadata && (
            <>
              <p>
                <strong>{metadata.algorithm}</strong> ·{" "}
                {metadata.input_features.length} input features ·{" "}
                {metadata.transformed_feature_count} transformed features
              </p>
              <p className="muted">
                {status === "ready"
                  ? "Prediction and SHAP services are ready."
                  : "Check backend readiness before requesting an output."}
              </p>
            </>
          )}
          <Link to="/doctor/about" className="text-link">
            Read scope and limitations
            <ArrowRight size={15} />
          </Link>
        </article>
      </div>
      <Disclaimer />
    </div>
  );
}
