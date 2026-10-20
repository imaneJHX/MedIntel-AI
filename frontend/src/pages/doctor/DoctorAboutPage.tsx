import { Link } from "react-router-dom";
import { Disclaimer } from "../../components/ui/Disclaimer";
export function DoctorAboutPage() {
  return (
    <div className="page space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow">EXPERIMENTAL SCOPE</p>
          <h1>Clinical workspace limitations</h1>
          <p>A demonstration environment for structured case exploration.</p>
        </div>
      </div>
      <section className="panel limitations">
        <h2>A role-specific interface, with no identity verification</h2>
        <p>
          Selecting this workspace does not verify a professional credential or
          authorize access to patient information. There are no real cases,
          patient accounts or secure clinical records.
        </p>
        <h2>Use fabricated cases only</h2>
        <p>
          The form uses the historical UCI Cleveland research model. Outputs
          classify recorded status in that dataset and are not diagnoses,
          treatment recommendations or clinical risk levels.
        </p>
        <ul>
          <li>
            Small historical cohort, with no independent external validation.
          </li>
          <li>Earlier exploration inspected the full cohort.</li>
          <li>
            Model scores are uncalibrated; SHAP associations are not causal.
          </li>
          <li>
            Some diagnostic inputs may be unavailable at a proposed decision
            time.
          </li>
          <li>
            This prototype is not authorized for clinical decision-making.
          </li>
        </ul>
        <Link to="/research/methodology" className="text-link">
          Review the research methodology
        </Link>
      </section>
      <Disclaimer />
    </div>
  );
}
