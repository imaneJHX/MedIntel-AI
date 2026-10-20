import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMetric } from "../../utils/provenance";
export default function MetricPlot({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart
        data={data}
        margin={{ top: 15, right: 5, bottom: 0, left: -23 }}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} stroke="#e8eeef" />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#596c7c", fontSize: 11 }}
          interval={0}
        />
        <YAxis
          domain={[0, 1]}
          tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "#758491", fontSize: 11 }}
        />
        <Tooltip
          formatter={(value) => formatMetric(Number(value))}
          cursor={{ fill: "#eff8f6" }}
        />
        <Bar
          dataKey="value"
          name="Historical metric"
          fill="#168d83"
          radius={[5, 5, 0, 0]}
          maxBarSize={44}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
