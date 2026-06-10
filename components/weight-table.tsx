"use client";

import { useState } from "react";

import { formatLossDelta, formatWeight } from "@/lib/weight-utils";
import type { ProfileHistoryRow, TrackingDisplayMode } from "@/types/app";

const RECENT_HISTORY_LIMIT = 12;

interface WeightTableProps {
  mode: TrackingDisplayMode;
  rows: ProfileHistoryRow[];
}

export function WeightTable({ mode, rows }: WeightTableProps) {
  const [showAll, setShowAll] = useState(false);
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
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">{title}</h2>
          <p className="text-sm text-ink/65">{rows.length > 0 ? summaryText : "No entries yet."}</p>
        </div>
        {hasOverflow ? (
          <button className="secondary-button px-4 py-2 text-sm" type="button" onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show latest" : "Show all"}
          </button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/60">
          No entries yet.
        </div>
      ) : (
        <div className={`${showAll ? "max-h-[28rem] overflow-y-auto pr-1" : ""} overflow-x-auto`}>
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#fbf7ef] text-xs uppercase tracking-[0.16em] text-ink/45">
              <tr>
                <th className="py-3 font-medium">Date</th>
                {mode === "weight" ? (
                  <th className="py-3 font-medium">Weight</th>
                ) : (
                  <>
                    <th className="py-3 font-medium">Change</th>
                    <th className="py-3 font-medium">Total lost</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-4 text-ink/75">{row.date}</td>
                  {mode === "weight" ? (
                    <td className="py-3 font-semibold text-ink">{row.weight !== null ? formatWeight(row.weight) : "Private"}</td>
                  ) : (
                    <>
                      <td className="py-3 pr-4 font-semibold text-ink">
                        {row.changeKg !== null ? formatLossDelta(row.changeKg) : "Initial state"}
                      </td>
                      <td className="py-3 font-semibold text-ink">{formatWeight(row.totalKgLost)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
