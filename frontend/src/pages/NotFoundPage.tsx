import { Link } from "react-router-dom";
export function NotFoundPage() {
  return (
    <div className="page">
      <section className="panel empty-page">
        <p className="eyebrow">404 · PAGE NOT FOUND</p>
        <h1>This page isn’t in the workspace.</h1>
        <p>Choose a workspace to continue exploring MedIntel AI.</p>
        <Link to="/" className="button primary">
          Choose a workspace
        </Link>
      </section>
    </div>
  );
}
