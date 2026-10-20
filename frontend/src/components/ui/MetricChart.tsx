import { lazy, Suspense } from "react";
import { metricLabels } from "../../utils/provenance";
const MetricPlot = lazy(() => import("./MetricPlot"));
export function MetricChart({ metrics }: { metrics: Record<string, number> }) {
  const data = ["accuracy", "precision", "recall", "f1", "roc_auc"]
    .filter((name) => metrics[name] !== undefined)
    .map((name) => ({ name: metricLabels[name], value: metrics[name] }));
  return (
    <>
      <div
        className="metric-chart"
        role="img"
        aria-label="Historical holdout metric comparison; exact values follow in a table."
      >
        <Suspense
          fallback={<p className="muted small">Loading metric chart…</p>}
        >
          <MetricPlot data={data} />
        </Suspense>
      </div>
      <details className="chart-values">
        <summary>View exact metric values</summary>
        <table>
          <caption className="sr-only">Historical holdout metrics</caption>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.name}>
                <th scope="row">{row.name}</th>
                <td>{row.value.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
