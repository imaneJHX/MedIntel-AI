import { Component, type ReactNode } from "react";
/** Avoid rendering internal exception details or inputs in a failed UI. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="page">
          <section className="panel" role="alert">
            <h1>The workspace could not render.</h1>
            <p>
              Reload to restore the application. Temporary inputs and results
              will be cleared.
            </p>
            <button
              type="button"
              className="button primary"
              onClick={() => window.location.reload()}
            >
              Reload workspace
            </button>
          </section>
        </main>
      );
    return this.props.children;
  }
}
