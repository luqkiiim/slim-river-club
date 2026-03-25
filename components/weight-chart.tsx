"use client";

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
  if (points.length === 0) {
    return (
      <div className="panel flex min-h-72 items-center justify-center p-6 text-center text-sm text-ink/60">
        {mode === "weight"
          ? "No weight history yet. Log your first weigh-in to see the chart."
          : "No progress history yet. Add an update to see the chart."}
      </div>
    );
  }

  const pointValues = points.map((point) => point.value);
  const lowerBound = Math.min(...pointValues, startValue ?? pointValues[0], targetValue ?? pointValues[0]);
  const upperBound = Math.max(...pointValues, startValue ?? pointValues[0], targetValue ?? pointValues[0]);
  const yAxisDomain = lowerBound === upperBound ? [lowerBound - 1, upperBound + 1] : [lowerBound, upperBound];
  const showStartGuide = startValue !== null;
  const showTargetGuide = targetValue !== null && targetValue !== startValue;

  return (
    <div className="panel p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">
          {mode === "weight" ? "Weight chart" : "Progress chart"}
        </h2>
        <p className="text-sm text-ink/65">
          {mode === "weight"
            ? "X axis is date, Y axis is weight."
            : "X axis is date, Y axis is total kg lost."}
        </p>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(31, 42, 31, 0.08)" />
            <XAxis dataKey="date" tick={{ fill: "#516151", fontSize: 12 }} />
            <YAxis
              type="number"
              domain={yAxisDomain}
              tick={{ fill: "#516151", fontSize: 12 }}
              tickFormatter={(value: number) => `${value}kg`}
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
              stroke="#4d8b5b"
              strokeWidth={3}
              dot={{ r: 4, fill: "#274235" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
