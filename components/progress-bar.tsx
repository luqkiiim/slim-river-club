import { formatPercentage } from "@/lib/weight-utils";

interface ProgressBarMetric {
  label: string;
  value: string;
}

interface ProgressBarProps {
  title: string;
  progressPct: number;
  metrics: readonly [ProgressBarMetric, ProgressBarMetric, ProgressBarMetric];
}

export function ProgressBar({ title, progressPct, metrics }: ProgressBarProps) {
  const clampedProgressPct = Math.min(Math.max(progressPct, 0), 100);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1 text-sm font-medium text-ink/80 sm:flex-row sm:items-center sm:justify-between">
        <span>{title}</span>
        <span className="font-semibold text-moss">{formatPercentage(progressPct)}</span>
      </div>

      <div className="h-4 overflow-hidden rounded-full bg-sand/80">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,_#4d8b5b_0%,_#83b58f_100%)] transition-[width]"
          style={{ width: `${clampedProgressPct}%` }}
        />
      </div>

      <div className="grid gap-2 text-xs font-medium uppercase tracking-[0.14em] text-ink/55 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl bg-white/55 px-3 py-2 sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0">
            <p>{metric.label}</p>
            <p className="mt-1 text-sm normal-case tracking-normal text-ink">{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
