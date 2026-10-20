import { Menu, RefreshCw } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useResearch } from "../../hooks/ResearchContext";
import { getWorkspace } from "../../utils/workspaces";
export function Header({
  toggle,
  open,
}: {
  toggle: () => void;
  open: boolean;
}) {
  const location = useLocation();
  const workspace = getWorkspace(location.pathname);
  const title =
    workspace.nav.find((item) => item.path === location.pathname)?.label ||
    "Page not found";
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <button
          type="button"
          className="icon-button mobile-menu"
          aria-label="Toggle navigation"
          aria-expanded={open}
          aria-controls="main-sidebar"
          onClick={toggle}
        >
          <Menu size={21} />
        </button>
        <span>{workspace.title}</span>
        <span className="breadcrumb-separator">/</span>
        <strong>{title}</strong>
      </div>
      {workspace.id === "patient" ? (
        <span className="tag neutral">EDUCATION ONLY</span>
      ) : (
        <BackendStatus />
      )}
    </header>
  );
}
function BackendStatus() {
  const { status, retry } = useResearch();
  const labels = {
    checking: "Checking backend",
    ready: "Backend ready",
    degraded: "Backend degraded",
    offline: "Backend offline",
  };
  return (
    <div className="header-actions">
      <span className={`connection ${status}`} role="status">
        <span className="status-dot" />
        {labels[status]}
      </span>
      <button
        type="button"
        className="icon-button"
        onClick={retry}
        aria-label="Refresh backend connection"
      >
        <RefreshCw size={16} />
      </button>
      <span className="environment-tag">LOCAL</span>
    </div>
  );
}
