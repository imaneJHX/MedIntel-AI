import { useEffect, useRef } from "react";
import { Activity } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
export function PlatformLayout() {
  const main = useRef<HTMLElement>(null);
  const location = useLocation();
  useEffect(() => {
    document.title = "MedIntel AI | Healthcare research & analysis";
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <div className="platform-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="platform-header">
        <Link
          to="/"
          className="brand"
          aria-label="MedIntel AI workspace selector"
        >
          <span className="brand-mark">
            <Activity size={25} />
          </span>
          <span>
            MedIntel<span className="brand-ai"> AI</span>
            <small>HEALTHCARE RESEARCH</small>
          </span>
        </Link>
        <WorkspaceSwitcher />
      </header>
      <main id="main-content" ref={main} tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="platform-footer">
        MedIntel AI · Local educational prototype · Workspace selection is not
        authentication.
      </footer>
    </div>
  );
}
