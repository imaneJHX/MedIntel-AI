import { CircleAlert } from "lucide-react";
export function ErrorMessage({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-message" role="alert">
      <CircleAlert size={20} aria-hidden="true" />
      <div>
        <strong>Unable to complete request</strong>
        <p>{message}</p>
        {retry && (
          <button type="button" className="text-button" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
