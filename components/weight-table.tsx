import { formatLossDelta, formatWeight } from "@/lib/weight-utils";
import type { ProfileHistoryRow, TrackingDisplayMode } from "@/types/app";

interface WeightTableProps {
  mode: TrackingDisplayMode;
  rows: ProfileHistoryRow[];
}

export function WeightTable({ mode, rows }: WeightTableProps) {
  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">
          {mode === "weight" ? "Weight history" : "Progress history"}
        </h2>
        <p className="text-sm text-ink/65">
          {mode === "weight"
            ? "Date and resolved weight, oldest first."
            : "Date, change from the previous update, and total kg lost, newest first."}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/60">
          No entries yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-ink/45">
              <tr>
                <th className="pb-3 font-medium">Date</th>
                {mode === "weight" ? (
                  <th className="pb-3 font-medium">Weight</th>
                ) : (
                  <>
                    <th className="pb-3 font-medium">Change</th>
                    <th className="pb-3 font-medium">Total lost</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map((row) => (
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
