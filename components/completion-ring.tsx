"use client";

import { Check } from "@phosphor-icons/react";
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

import { formatPercentage } from "@/lib/weight-utils";

interface CompletionRingProps {
  compact?: boolean;
  label: string;
  mini?: boolean;
  progressPct: number;
  value: string;
}

export function CompletionRing({ compact = false, label, mini = false, progressPct, value }: CompletionRingProps) {
  const clampedProgress = Math.min(Math.max(progressPct, 0), 100);
  const complete = progressPct >= 100;

  return (
    <div
      aria-label={`${label}: ${value}, ${formatPercentage(progressPct)}`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(clampedProgress)}
      className={`relative mx-auto aspect-square w-full ${mini ? "max-w-[64px]" : compact ? "max-w-[176px]" : "max-w-[260px]"}`}
      role="progressbar"
    >
      <div aria-hidden className="absolute inset-0">
        <ResponsiveContainer height="100%" width="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            data={[{ progress: clampedProgress }]}
            endAngle={-45}
            innerRadius="77%"
            outerRadius="96%"
            startAngle={225}
          >
            <PolarAngleAxis angleAxisId={0} domain={[0, 100]} tick={false} type="number" />
            <RadialBar
              angleAxisId={0}
              background={{ fill: mini ? "#C9D8C8" : "#EEE7DB" }}
              cornerRadius={18}
              dataKey="progress"
              fill={mini ? "#3F7047" : "#4B7C50"}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className={`absolute flex items-center justify-center rounded-full text-center ${
        mini ? "inset-[22%] bg-transparent" : "inset-[20%] flex-col bg-cream/85"
      }`}>
        {mini ? <strong className="text-xs font-semibold tracking-tight text-ink">{value}</strong> : <>
        <span className={`${compact ? "text-[11px]" : "text-xs"} font-semibold uppercase tracking-[0.16em] text-moss`}>{label}</span>
        <strong className={`${compact ? "text-xl sm:text-2xl" : "text-3xl"} mt-1 font-semibold tracking-tight text-ink`}>{value}</strong>
        <span
          className={`${compact ? "mt-2 h-8 w-8" : "mt-3 h-10 w-10"} grid place-items-center rounded-full ${
            complete ? "bg-peach text-moss" : "bg-sand text-ink/70"
          }`}
        >
          <Check aria-hidden size={compact ? 18 : 23} weight="bold" />
        </span>
        </>}
      </div>
    </div>
  );
}
