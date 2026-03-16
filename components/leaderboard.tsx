import Link from "next/link";

import type { LeaderboardRow } from "@/types/app";

interface LeaderboardProps {
  lossLeaderboard: LeaderboardRow[];
  progressLeaderboard: LeaderboardRow[];
}

function LeaderboardList({
  title,
  tone = "default",
  rows,
}: {
  title: string;
  tone?: "default" | "progress";
  rows: LeaderboardRow[];
}) {
  return (
    <section className="panel p-4 sm:p-5">
      <div className="mb-4 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Leaderboard</span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/60">
          No rankings yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row, index) => {
            const progressFillPct = tone === "progress" ? Math.min(Math.max(row.metric, 0), 100) : 0;

            return (
              <Link
                key={`${title}-${row.userId}`}
                href={`/users/${row.userId}`}
                className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-black/5 bg-white/80 px-4 py-2.5 transition hover:border-moss/30 hover:bg-white"
              >
                {tone === "progress" ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-1.5 left-2 rounded-xl bg-[#dbe9dd] transition-[width]"
                    style={{ width: `${progressFillPct}%` }}
                  />
                ) : null}

                <div className="relative flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-semibold text-moss">
                    {index + 1}
                  </div>
                  <span className="truncate font-medium text-ink">{row.name}</span>
                </div>

                <span className="relative shrink-0 font-semibold text-moss">{row.valueLabel}</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function Leaderboard({ lossLeaderboard, progressLeaderboard }: LeaderboardProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <LeaderboardList title="Kg lost" rows={lossLeaderboard} />
      <LeaderboardList title="Target progress" rows={progressLeaderboard} tone="progress" />
    </div>
  );
}
