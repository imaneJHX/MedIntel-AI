import { FlaskConical } from "lucide-react";
export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className={`disclaimer ${compact ? "compact" : ""}`}
      aria-label="Research disclaimer"
    >
      <FlaskConical size={19} aria-hidden="true" />
      <div>
        <strong>For research and education only.</strong> Experimental outputs
        are not medical diagnoses or clinically calibrated risk estimates.
        {!compact &&
          " Use fabricated demonstration inputs; do not enter real patient information."}
      </div>
    </aside>
  );
}
