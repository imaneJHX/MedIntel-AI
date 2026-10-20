import { ShieldCheck } from "lucide-react";
export function PatientSafetyNotice() {
  return (
    <aside
      className="patient-safety"
      aria-label="Patient education and privacy notice"
    >
      <ShieldCheck size={22} aria-hidden="true" />
      <div>
        <strong>Your learning space, with clear boundaries.</strong>
        <p>
          This portal provides educational information only. Consult a qualified
          healthcare professional for medical interpretation, diagnosis, and
          treatment.
        </p>
        <p>
          Only explicitly marked synthetic reports may be submitted to the local
          report explorer. Never upload real patient documents. There are no
          patient accounts or stored medical records.
        </p>
      </div>
    </aside>
  );
}
