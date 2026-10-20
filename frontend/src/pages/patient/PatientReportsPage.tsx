import { ReportUpload } from "../../components/patient/ReportUpload";
import { PatientSafetyNotice } from "../../components/patient/PatientSafetyNotice";
export function PatientReportsPage() {
  return (
    <div className="page patient-page space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            SYNTHETIC REPORTS · TRANSCRIPTION EXPLORATION
          </p>
          <h1>Medical Report Explorer</h1>
          <p>
            Upload a synthetic laboratory report to explore extracted
            measurements and learn what the reported terms mean.
          </p>
        </div>
      </div>
      <ReportUpload />
      <PatientSafetyNotice />
    </div>
  );
}
