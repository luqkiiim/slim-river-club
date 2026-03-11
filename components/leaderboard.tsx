import Link from "next/link";

import type { LeaderboardRow } from "@/types/app";

interface LeaderboardProps {
  lossLeaderboard: LeaderboardRow[];
  progressLeaderboard: LeaderboardRow[];
}

function LeaderboardList({
  title,
  rows,
}: {
  title: string;
  rows: LeaderboardRow[];
}) {
  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">{title}</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Leaderboard</span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/60">
          No rankings yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <Link
              key={`${title}-${row.userId}`}
              href={`/users/${row.userId}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white/80 px-4 py-3 transition hover:border-moss/30 hover:bg-white"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand text-sm font-semibold text-moss">
                  {index + 1}
                </div>
                <span className="truncate font-medium text-ink">{row.name}</span>
              </div>
              <span className="shrink-0 font-semibold text-moss">{row.valueLabel}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function Leaderboard({ lossLeaderboard, progressLeaderboard }: LeaderboardProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <LeaderboardList title="Kg lost" rows={lossLeaderboard} />
      <LeaderboardList title="Target progress" rows={progressLeaderboard} />
    </div>
  );
}
