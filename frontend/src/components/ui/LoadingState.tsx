import { LoaderCircle } from "lucide-react";
export function LoadingState({
  label = "Loading research workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={20} aria-hidden="true" />
      {label}
    </div>
  );
}
