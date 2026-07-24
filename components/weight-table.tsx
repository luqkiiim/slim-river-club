"use client";

import { useId, useState } from "react";

import { formatLossDelta, formatWeight } from "@/lib/weight-utils";
import type { ProfileHistoryRow, TrackingDisplayMode } from "@/types/app";

const RECENT_HISTORY_LIMIT = 12;

interface WeightTableProps {
  mode: TrackingDisplayMode;
  rows: ProfileHistoryRow[];
}

export function WeightTable({ mode, rows }: WeightTableProps) {
  const [showAll, setShowAll] = useState(false);
  const titleId = useId();
  const summaryId = useId();
  const historyId = useId();
  const hasOverflow = rows.length > RECENT_HISTORY_LIMIT;
  const visibleRows = showAll ? rows : rows.slice(0, RECENT_HISTORY_LIMIT);
  const title = mode === "weight" ? "Weight history" : "Progress history";
  const historyLabel = mode === "weight" ? "weight" : "progress";
  const summaryText = hasOverflow
    ? showAll
      ? `Showing all ${rows.length} ${historyLabel} entries.`
      : `Showing latest ${visibleRows.length} of ${rows.length} ${historyLabel} entries.`
    : rows.length === 1
      ? `Showing 1 ${historyLabel} entry.`
      : `Showing ${rows.length} ${historyLabel} entries.`;

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby={titleId}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id={titleId} className="text-lg font-semibold [font-family:var(--font-heading)]">{title}</h2>
          <p id={summaryId} aria-live="polite" className="mt-1 text-sm text-ink/70">
            {rows.length > 0 ? summaryText : "No entries yet."}
          </p>
        </div>
        {hasOverflow ? (
          <button
            aria-controls={historyId}
            aria-expanded={showAll}
            className="secondary-button min-h-11 w-full px-4 py-2 text-sm sm:w-auto"
            type="button"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? "Show latest" : "Show all"}
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/70">
          No entries yet.
        </div>
      ) : (
        <div id={historyId} aria-describedby={summaryId}>
          <ol className="divide-y divide-black/5 sm:hidden">
            {visibleRows.map((row) => (
              <li key={row.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <time className="text-sm font-medium text-ink/70" dateTime={row.isoDate}>
                    {row.date}
                  </time>
                  {mode === "weight" ? (
                    <p className="text-right text-base font-semibold tabular-nums text-ink">
                      {row.weight !== null ? formatWeight(row.weight) : "Private"}
                    </p>
                  ) : (
                    <p className="text-right text-base font-semibold tabular-nums text-ink">
                      {formatWeight(row.totalKgLost)}
                      <span className="mt-0.5 block text-xs font-medium text-ink/70">total lost</span>
                    </p>
                  )}
                </div>
                {mode === "loss" ? (
                  <p className="mt-2 text-sm text-ink/70">
                    {row.changeKg !== null ? formatLossDelta(row.changeKg) : "Initial state"}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>

          <div className={`${showAll ? "sm:max-h-[28rem] sm:overflow-y-auto sm:pr-1" : ""} hidden overflow-x-auto sm:block`}>
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">{summaryText}</caption>
              <thead className="sticky top-0 z-10 bg-[#fbf7ef] text-xs uppercase tracking-[0.16em] text-ink/70">
                <tr>
                  <th className="py-3 font-medium" scope="col">Date</th>
                  {mode === "weight" ? (
                    <th className="py-3 font-medium" scope="col">Weight</th>
                  ) : (
                    <>
                      <th className="py-3 font-medium" scope="col">Change</th>
                      <th className="py-3 font-medium" scope="col">Total lost</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 pr-4 text-ink/75">
                      <time dateTime={row.isoDate}>{row.date}</time>
                    </td>
                    {mode === "weight" ? (
                      <td className="py-3 font-semibold tabular-nums text-ink">
                        {row.weight !== null ? formatWeight(row.weight) : "Private"}
                      </td>
                    ) : (
                      <>
                        <td className="py-3 pr-4 font-semibold tabular-nums text-ink">
                          {row.changeKg !== null ? formatLossDelta(row.changeKg) : "Initial state"}
                        </td>
                        <td className="py-3 font-semibold tabular-nums text-ink">{formatWeight(row.totalKgLost)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
