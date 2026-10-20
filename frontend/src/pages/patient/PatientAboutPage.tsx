import { PatientSafetyNotice } from "../../components/patient/PatientSafetyNotice";
export function PatientAboutPage() {
  return (
    <div className="page patient-page space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CLEAR EXPECTATIONS</p>
          <h1>Privacy and your learning space</h1>
          <p>Understand what this prototype offers today.</p>
        </div>
      </div>
      <div className="patient-actions">
        <section className="panel">
          <h2>What you can do here</h2>
          <p>
            Read short educational explanations, follow links to trusted public
            information, and explore questions for a healthcare professional.
          </p>
          <p>
            The report explorer accepts explicitly marked synthetic
            demonstration files for local extraction and manual transcription
            review. There are no personal result assessments or patient
            prediction tools.
          </p>
        </section>
        <section className="panel">
          <h2>What choosing a workspace means</h2>
          <p>
            Choosing Patient, Doctor or Researcher changes the interface. It
            does not sign you in, verify credentials, or authorize access to
            records.
          </p>
          <p>
            No patient records, uploaded documents, corrections or account
            details are stored. Only an explicit upload calls the local report
            extraction endpoint; this workspace does not contact prediction or
            model explanation services.
          </p>
        </section>
      </div>
      <section className="panel">
        <h2>Future capabilities need further work</h2>
        <p>
          Synthetic document extraction and manual review are available locally.
          Real medical information would require authentication, authorization,
          secure storage, privacy review and applicable regulatory assessment
          before any production use.
        </p>
      </section>
      <PatientSafetyNotice />
    </div>
  );
}
