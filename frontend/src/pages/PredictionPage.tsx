import { useResearch } from "../hooks/ResearchContext";
import { PatientForm } from "../components/prediction/PatientForm";
import { PredictionResult } from "../components/prediction/PredictionResult";
import { Disclaimer } from "../components/ui/Disclaimer";
import { LoadingState } from "../components/ui/LoadingState";
import { ErrorMessage } from "../components/ui/ErrorMessage";
export function PredictionPage({ clinical = false }: { clinical?: boolean }) {
  const { schema, loading, resourceError, retry } = useResearch();
  return (
    <div className="page space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {clinical
              ? "FABRICATED CASE · CLINICAL RESEARCH"
              : "HEART DISEASE · TABULAR RESEARCH"}
          </p>
          <h1>
            {clinical
              ? "Explore a demonstration case."
              : "Explore a prediction."}
          </h1>
          <p>
            {clinical
              ? "Review grouped clinical inputs and examine an experimental model output."
              : "One observation. A transparent experimental output."}
          </p>
        </div>
      </div>
      <Disclaimer />
      {loading && <LoadingState label="Loading supported input definitions…" />}
      {resourceError && <ErrorMessage message={resourceError} retry={retry} />}
      {schema && (
        <div className="prediction-layout">
          <PatientForm schema={schema} grouped={clinical} />
          <div className="result-column">
            <PredictionResult />
            <div className="privacy-note">
              <strong>A temporary workspace</strong>
              <p>
                Inputs and outputs stay in page memory and are sent only to the
                configured API. Refreshing clears them. No patient history is
                stored by this dashboard.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
