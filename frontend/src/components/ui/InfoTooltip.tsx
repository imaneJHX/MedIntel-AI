import { useId, useState } from "react";
import { Info } from "lucide-react";
export function InfoTooltip({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="field-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="icon-button"
        aria-label={`About ${label}`}
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        <Info size={15} />
      </button>
      <span
        id={id}
        className={`field-tooltip ${open ? "visible" : ""}`}
        role="tooltip"
      >
        {description}
      </span>
    </span>
  );
}
