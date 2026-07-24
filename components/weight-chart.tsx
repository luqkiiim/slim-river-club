"use client";

import { useId } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatWeight } from "@/lib/weight-utils";
import type { TrackingDisplayMode } from "@/types/app";

interface WeightChartProps {
  mode: TrackingDisplayMode;
  points: Array<{ date: string; value: number }>;
  startValue: number | null;
  targetValue: number | null;
}

export function WeightChart({ mode, points, startValue, targetValue }: WeightChartProps) {
  const chartTitleId = useId();
  const chartSummaryId = useId();

  if (points.length === 0) {
    return (
      <section className="panel p-5 sm:p-6" aria-labelledby={chartTitleId}>
        <h2 id={chartTitleId} className="text-lg font-semibold [font-family:var(--font-heading)]">
          {mode === "weight" ? "Weight trend" : "Progress trend"}
        </h2>
        <div className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/70">
          {mode === "weight"
            ? "No weight history yet. Log your first weigh-in to see the chart."
            : "No progress history yet. Add an update to see the chart."}
        </div>
      </section>
    );
  }

  const chartLabel = mode === "weight" ? "Recorded weight" : "Total weight lost";
  const pointValues = points.map((point) => point.value);
  const firstPoint = points[0];
  const latestPoint = points[points.length - 1];
  const lowerBound = Math.min(...pointValues, startValue ?? pointValues[0], targetValue ?? pointValues[0]);
  const upperBound = Math.max(...pointValues, startValue ?? pointValues[0], targetValue ?? pointValues[0]);
  const yAxisDomain = lowerBound === upperBound ? [lowerBound - 1, upperBound + 1] : [lowerBound, upperBound];
  const showStartGuide = startValue !== null;
  const showTargetGuide = targetValue !== null && targetValue !== startValue;
  const summary = `${chartLabel} changed from ${formatWeight(firstPoint.value)} on ${firstPoint.date} to ${formatWeight(
    latestPoint.value,
  )} on ${latestPoint.date}.`;

  return (
    <figure className="panel p-5 sm:p-6" aria-labelledby={chartTitleId} aria-describedby={chartSummaryId}>
      <div>
        <h2 id={chartTitleId} className="text-lg font-semibold [font-family:var(--font-heading)]">
          {mode === "weight" ? "Weight trend" : "Progress trend"}
        </h2>
      </div>
      <figcaption id={chartSummaryId} className="mb-4 mt-1 text-sm leading-6 text-ink/70">
        {summary}
      </figcaption>

      <ul aria-label="Chart legend" className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-ink/70">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-1 w-5 rounded-full bg-leaf" />
          {chartLabel}
        </li>
        {showStartGuide ? (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="w-5 border-t-2 border-dashed border-ink/35" />
            Start {formatWeight(startValue)}
          </li>
        ) : null}
        {showTargetGuide ? (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="w-5 border-t-2 border-dashed border-[#b8872f]" />
            Target {formatWeight(targetValue)}
          </li>
        ) : null}
      </ul>

      <div aria-hidden="true" className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(31, 42, 31, 0.08)" />
            <XAxis
              axisLine={false}
              dataKey="date"
              minTickGap={24}
              tick={{ fill: "#516151", fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              type="number"
              domain={yAxisDomain}
              tick={{ fill: "#516151", fontSize: 12 }}
              tickFormatter={(value: number) => `${value}kg`}
              tickLine={false}
              width={54}
            />
            {showStartGuide ? (
              <ReferenceLine y={startValue!} stroke="rgba(31,42,31,0.28)" strokeDasharray="6 6" ifOverflow="extendDomain" />
            ) : null}
            {showTargetGuide ? (
              <ReferenceLine y={targetValue!} stroke="#b8872f" strokeDasharray="6 6" ifOverflow="extendDomain" />
            ) : null}
            <Tooltip
              formatter={(value: number) => formatWeight(Number(value))}
              contentStyle={{
                borderRadius: 16,
                border: "1px solid rgba(31,42,31,0.08)",
                boxShadow: "0 10px 24px rgba(31,42,31,0.12)",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name={chartLabel}
              stroke="#4d8b5b"
              strokeWidth={3}
              dot={{ r: 4, fill: "#274235" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>{`${chartLabel} chart data`}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">{mode === "weight" ? "Weight" : "Total lost"}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={`${point.date}-${point.value}-${index}`}>
              <td>{point.date}</td>
              <td>{formatWeight(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
