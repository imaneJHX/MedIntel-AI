import { healthEducation } from "../../data/healthEducation";
import { HealthEducationCard } from "../../components/patient/HealthEducationCard";
import { PatientSafetyNotice } from "../../components/patient/PatientSafetyNotice";
export function PatientLearnPage() {
  return (
    <div className="page patient-page space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SMALL EXPLANATIONS, USEFUL QUESTIONS</p>
          <h1>Learn about common measurements</h1>
          <p>
            General information from MedlinePlus, the U.S. National Library of
            Medicine.
          </p>
        </div>
      </div>
      <p className="patient-reading-note">
        Reference ranges and interpretation depend on the test, laboratory and
        individual context. This portal does not assess values or identify
        medical conditions.
      </p>
      <div className="education-grid">
        {healthEducation.map((topic) => (
          <HealthEducationCard key={topic.id} topic={topic} />
        ))}
      </div>
      <PatientSafetyNotice />
    </div>
  );
}
