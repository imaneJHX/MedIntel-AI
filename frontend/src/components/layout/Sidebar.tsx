import { Activity, ArrowUpRight, FlaskConical, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../../services/api";
import { getWorkspace } from "../../utils/workspaces";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
export function Sidebar({ open, close }: { open: boolean; close: () => void }) {
  const workspace = getWorkspace(useLocation().pathname);
  return (
    <>
      {open && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={close}
        />
      )}
      <aside id="main-sidebar" className={`sidebar ${open ? "is-open" : ""}`}>
        <NavLink
          to="/"
          className="brand"
          onClick={close}
          aria-label="MedIntel AI workspace selector"
        >
          <span className="brand-mark">
            <Activity size={25} />
          </span>
          <span>
            MedIntel<span className="brand-ai"> AI</span>
            <small>HEALTHCARE RESEARCH</small>
          </span>
        </NavLink>
        <button
          type="button"
          className="icon-button mobile-close"
          aria-label="Close navigation"
          onClick={close}
        >
          <X size={20} />
        </button>
        <WorkspaceSwitcher selected={workspace.id} onSwitch={close} />
        <div className="nav-caption">{workspace.title}</div>
        <nav aria-label="Main navigation">
          {workspace.nav.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === workspace.base}
              onClick={close}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={19} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="research-note">
            <FlaskConical size={21} aria-hidden="true" />
            <strong>
              {workspace.id === "patient"
                ? "Built for understanding"
                : "Open demonstration"}
            </strong>
            <p>
              {workspace.id === "patient"
                ? "General information to support a conversation with a healthcare professional."
                : "No professional verification or secure patient access is provided."}
            </p>
            <span className="tag">
              {workspace.id === "patient" ? "EDUCATION ONLY" : "EXPERIMENTAL"}
            </span>
          </div>
          <a
            href={
              workspace.id === "patient"
                ? "/patient/about"
                : `${API_BASE_URL}/docs`
            }
            target={workspace.id === "patient" ? undefined : "_blank"}
            rel={workspace.id === "patient" ? undefined : "noreferrer"}
            className="docs-link"
          >
            {workspace.id === "patient"
              ? "Privacy & scope"
              : "API documentation"}{" "}
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
          <div className="sidebar-footer">
            <span className="tiny-dot" />
            Local research environment
          </div>
        </div>
      </aside>
    </>
  );
}
