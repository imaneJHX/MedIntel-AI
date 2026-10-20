import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Contribution } from "../../types/api";
export function ShapContributionChart({
  contributions,
}: {
  contributions: Contribution[];
}) {
  const [all, setAll] = useState(false);
  const sorted = [...contributions].sort(
    (a, b) =>
      Math.abs(b.contribution_log_odds) - Math.abs(a.contribution_log_odds),
  );
  const displayed = all ? sorted : sorted.slice(0, 10);
  const data = displayed.map((row) => ({
    name: row.feature,
    value: row.contribution_log_odds,
  }));
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">INDIVIDUAL SHAP EXPLANATION</p>
          <h2>What moved this output?</h2>
        </div>
        <button
          type="button"
          className="button secondary small-button"
          onClick={() => setAll((value) => !value)}
          aria-pressed={all}
        >
          {all ? "Show top 10" : "Show all 28"}
        </button>
      </div>
      <p className="muted">
        Ranked by absolute contribution for this observation. Values are
        positive-class log-odds, not probability changes.
      </p>
      <div className="chart-legend">
        <span>
          <i className="legend-dot positive" />
          Increases positive-class output
        </span>
        <span>
          <i className="legend-dot negative" />
          Decreases positive-class output
        </span>
      </div>
      <div
        className="shap-chart"
        style={{ height: Math.max(350, data.length * 34) }}
        role="img"
        aria-label="SHAP contributions in positive-class log-odds. A full accessible table follows."
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ left: 6, right: 25, top: 10, bottom: 15 }}
            accessibilityLayer
          >
            <CartesianGrid horizontal={false} stroke="#e8eeef" />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              label={{
                value: "Contribution (log-odds)",
                position: "insideBottom",
                offset: -10,
                fontSize: 12,
              }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={148}
              tick={{ fontSize: 10, fill: "#44586a" }}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine x={0} stroke="#8d9ba5" />
            <Tooltip
              formatter={(value) => [
                Number(value).toFixed(5),
                "Contribution (log-odds)",
              ]}
            />
            <Bar dataKey="value" isAnimationActive={false} radius={3}>
              {data.map((row) => (
                <Cell
                  key={row.name}
                  fill={row.value >= 0 ? "#0d857c" : "#7967ad"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-values">
        <summary>View all 28 contributions and transformed values</summary>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scrollable feature contributions"
        >
          <table>
            <caption className="sr-only">
              All individual feature contributions
            </caption>
            <thead>
              <tr>
                <th>Transformed feature</th>
                <th>Input feature</th>
                <th>Transformed value</th>
                <th>Contribution (log-odds)</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.feature}>
                  <th scope="row">{row.feature}</th>
                  <td>{row.original_feature}</td>
                  <td>{row.transformed_value.toFixed(4)}</td>
                  <td>
                    {row.contribution_log_odds >= 0 ? "+" : ""}
                    {row.contribution_log_odds.toFixed(5)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
