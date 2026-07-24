import { formatPercentage } from "@/lib/weight-utils";

interface ProgressBarMetric {
  label: string;
  value: string;
}

interface ProgressBarProps {
  compact?: boolean;
  hidePercentage?: boolean;
  title: string;
  progressPct: number;
  metrics?: readonly ProgressBarMetric[];
}

export function ProgressBar({ compact = false, hidePercentage = false, title, progressPct, metrics }: ProgressBarProps) {
  const resolvedMetrics = metrics ?? [];
  const clampedProgressPct = Math.min(Math.max(progressPct, 0), 100);
  const formattedProgress = formatPercentage(progressPct);
  const hasMetrics = resolvedMetrics.length > 0;
  const metricColumnsClass =
    resolvedMetrics.length === 1
      ? "grid-cols-1"
      : resolvedMetrics.length === 2
        ? "grid-cols-2"
        : resolvedMetrics.length === 3
          ? "grid-cols-2 sm:grid-cols-3"
          : "grid-cols-2 sm:grid-cols-4";

  return (
    <div className={compact ? "space-y-2" : hasMetrics ? "space-y-2.5" : "space-y-3"}>
      <div className={`flex flex-col gap-1 font-medium text-ink/80 sm:flex-row sm:items-center sm:justify-between ${compact ? "text-[13px]" : "text-sm"}`}>
        <span>{title}</span>
        {hidePercentage ? null : <span className="font-semibold tabular-nums text-moss">{formattedProgress}</span>}
      </div>

      <div
        aria-label={title}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(clampedProgressPct)}
        aria-valuetext={`${formattedProgress} complete`}
        className={`${compact ? "h-2.5" : "h-3.5"} overflow-hidden rounded-full bg-sand/80`}
        role="progressbar"
      >
        <div
          aria-hidden="true"
          className="h-full rounded-full bg-leaf transition-[width] motion-reduce:transition-none"
          style={{ width: `${clampedProgressPct}%` }}
        />
      </div>

      {hasMetrics ? (
        <dl className={`grid ${metricColumnsClass} gap-2 text-xs text-ink/70`}>
          {resolvedMetrics.map((metric) => (
            <div key={metric.label} className="min-w-0 rounded-xl bg-white/55 px-3 py-2 sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0">
              <dt>{metric.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{metric.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
