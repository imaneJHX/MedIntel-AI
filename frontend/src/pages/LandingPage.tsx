import { ArrowRight, Check, Compass, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { workspaces } from "../utils/workspaces";
export function LandingPage() {
  return (
    <div className="platform-page">
      <section className="landing-intro">
        <div className="landing-copy">
          <p className="eyebrow">THREE PERSPECTIVES. ONE RESEARCH PLATFORM.</p>
          <h1>MedIntel AI</h1>
          <p className="landing-subtitle">
            Intelligent Healthcare Research &amp; Analysis Platform
          </p>
          <p className="landing-description">
            Explore healthcare information, structured clinical research, and
            explainable artificial intelligence through dedicated workspaces.
          </p>
          <div className="landing-values">
            <span>
              <Check size={16} />
              Clear information
            </span>
            <span>
              <Check size={16} />
              Transparent research
            </span>
            <span>
              <Check size={16} />
              Thoughtful exploration
            </span>
          </div>
        </div>
        <div
          className="landing-diagram"
          aria-label="Three ways to explore MedIntel AI"
        >
          <span className="diagram-icon">
            <Compass size={31} />
          </span>
          <p>Choose your perspective.</p>
          <strong>
            Understand.
            <br />
            Explore.
            <br />
            <span>Explain.</span>
          </strong>
          <small>A dedicated space for every kind of curiosity.</small>
        </div>
      </section>
      <section
        className="workspace-section"
        aria-labelledby="workspace-heading"
      >
        <div className="section-title">
          <div>
            <p className="eyebrow">FIND YOUR WORKSPACE</p>
            <h2 id="workspace-heading">How would you like to explore?</h2>
          </div>
          <span className="tag neutral">OPEN DEMONSTRATION</span>
        </div>
        <div className="workspace-cards">
          {Object.values(workspaces).map((workspace) => {
            const Icon = workspace.icon;
            return (
              <article
                key={workspace.id}
                className={`workspace-card ${workspace.id}`}
              >
                <div className="workspace-card-top">
                  <span className="workspace-icon">
                    <Icon size={26} />
                  </span>
                  <span className="workspace-code">
                    {workspace.id === "patient"
                      ? "01"
                      : workspace.id === "doctor"
                        ? "02"
                        : "03"}
                  </span>
                </div>
                <h3>{workspace.cardTitle}</h3>
                <p>{workspace.description}</p>
                <div className="workspace-card-note">{workspace.note}</div>
                <Link
                  className={`button ${workspace.id === "research" ? "primary" : "secondary"}`}
                  to={workspace.base}
                >
                  {workspace.action}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
      <aside className="platform-notice" aria-label="Platform research notice">
        <ShieldCheck size={22} aria-hidden="true" />
        <p>
          MedIntel AI is a research and educational prototype. It is not a
          clinically validated medical device and does not provide medical
          diagnoses.
        </p>
      </aside>
    </div>
  );
}
