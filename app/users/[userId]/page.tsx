import { BmiMeter } from "@/components/bmi-meter";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ParticipantPrivacyForm } from "@/components/participant-privacy-form";
import { PrivateStartingWeightForm } from "@/components/private-starting-weight-form";
import { ProgressBar } from "@/components/progress-bar";
import { WeightChart } from "@/components/weight-chart";
import { WeightTable } from "@/components/weight-table";
import { getUserProfilePayload } from "@/lib/data";
import { requireSession } from "@/lib/session";
import { formatDate, formatRm, formatWeight, getMonthLabel } from "@/lib/weight-utils";
import type { UserProfilePayload } from "@/types/app";

function buildProgressContent(displayMode: "weight" | "loss", user: UserProfilePayload["user"]) {
  if (displayMode === "weight" && user.startWeight !== null && user.currentWeight !== null && user.targetWeight !== null) {
    return {
      title: "Progress toward target",
      metrics: [
        { label: "Start", value: formatWeight(user.startWeight) },
        { label: "Current", value: formatWeight(user.currentWeight) },
        { label: "Target", value: formatWeight(user.targetWeight) },
      ] as const,
    };
  }

  return {
    title: "Progress toward target loss",
    metrics: [
      { label: "Mode", value: user.needsStartingWeight ? "Baseline pending" : "Private" },
      { label: "Lost", value: formatWeight(user.kgLost) },
      { label: "Target", value: user.targetLossKg !== null ? formatWeight(user.targetLossKg) : "Not set" },
    ] as const,
  };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await requireSession();
  const { userId } = await params;
  const payload = await getUserProfilePayload(userId, session.user.id);

  if (!payload) {
    notFound();
  }

  const progressContent = buildProgressContent(payload.displayMode, payload.user);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">User profile</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold [font-family:var(--font-heading)]">{payload.user.name}</h1>
            {payload.user.isPrivate ? (
              <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-semibold text-ink/70">Private</span>
            ) : null}
          </div>
        </div>
        <Link className="secondary-button" href="/dashboard">
          Back to dashboard
        </Link>
      </div>

      <section className="panel mb-6 p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-ink/65">{payload.user.email ?? "No email linked yet"}</p>
            <p className="mt-2 text-sm text-ink/65">
              Monthly status: <span className="font-semibold text-ink">{payload.user.monthlyStatus}</span>
            </p>
            <p className="mt-2 text-sm text-ink/65">
              Monthly target: <span className="font-semibold text-ink">{formatWeight(payload.user.monthlyLossTargetKg)}</span>
            </p>
            <p className="mt-2 text-sm text-ink/65">
              This month requires:{" "}
              <span className="font-semibold text-ink">
                {formatWeight(payload.user.currentMonthRequiredLossKg)}
                {payload.user.currentMonthTargetPct !== 100 ? ` (${payload.user.currentMonthTargetPct}% rule)` : ""}
              </span>
            </p>
            <p className="mt-2 text-sm text-ink/65">
              Penalty if missed: <span className="font-semibold text-ink">{formatRm(payload.user.monthlyPenaltyRm)}</span>
            </p>
            <p className="mt-2 text-sm text-ink/65">
              Challenge start:{" "}
              <span className="font-semibold text-ink">
                {payload.user.challengeStartDateIso ? formatDate(new Date(payload.user.challengeStartDateIso)) : "Not set"}
              </span>
            </p>
          </div>
          <div className="rounded-3xl bg-sand/70 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Total RM owed</p>
            <p className="mt-2 text-2xl font-semibold [font-family:var(--font-heading)]">{formatRm(payload.user.totalRmOwed)}</p>
          </div>
        </div>

        <ProgressBar title={progressContent.title} progressPct={payload.user.progressPct} metrics={progressContent.metrics} />

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
              {payload.displayMode === "weight" ? "Current weight" : "Total lost"}
            </p>
            <p className="mt-2 font-semibold text-ink">
              {payload.displayMode === "weight" && payload.user.currentWeight !== null
                ? formatWeight(payload.user.currentWeight)
                : formatWeight(payload.user.kgLost)}
            </p>
          </div>
          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
              {payload.displayMode === "weight" ? "Total lost" : "Target loss"}
            </p>
            <p className="mt-2 font-semibold text-ink">
              {payload.displayMode === "weight"
                ? formatWeight(payload.user.kgLost)
                : payload.user.targetLossKg !== null
                  ? formatWeight(payload.user.targetLossKg)
                  : "Not set"}
            </p>
          </div>
          <div className="panel-muted p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
              {payload.displayMode === "weight" ? "Target weight" : "Progress"}
            </p>
            <p className="mt-2 font-semibold text-ink">
              {payload.displayMode === "weight" && payload.user.targetWeight !== null
                ? formatWeight(payload.user.targetWeight)
                : `${payload.user.progressPct}%`}
            </p>
          </div>
        </div>

        {payload.canEditStartingWeight || payload.canManagePrivacy ? (
          <div className="mt-5 space-y-4">
            {payload.canEditStartingWeight ? (
              <PrivateStartingWeightForm currentValue={payload.user.startWeight} />
            ) : null}
            {payload.canManagePrivacy ? <ParticipantPrivacyForm isPrivate={payload.user.isPrivate} /> : null}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <WeightChart
            mode={payload.displayMode}
            points={payload.chartPoints}
            startValue={payload.displayMode === "weight" ? payload.user.startWeight : 0}
            targetValue={payload.displayMode === "weight" ? payload.user.targetWeight : payload.user.targetLossKg}
          />
          {payload.bmi ? <BmiMeter bmi={payload.bmi} /> : null}
        </div>
        <WeightTable mode={payload.displayMode} rows={payload.history} />
      </div>

      <section className="panel mt-6 p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">Monthly results</h2>
          <p className="text-sm text-ink/65">Closed months only. Exempt months started mid-month and do not add a penalty.</p>
        </div>

        {payload.monthlyResults.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/60">
            No closed monthly results yet.
          </div>
        ) : (
          <>
            <div className="space-y-4 sm:hidden">
              {payload.monthlyResults.map((result) => (
                <article key={result.id} className="rounded-3xl border border-black/10 bg-white/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{getMonthLabel(result.month, result.year)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/45">Monthly result</p>
                    </div>
                    <span className="status-chip bg-sand text-ink/75">{result.status}</span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="panel-muted p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Start</p>
                      <p className="mt-1 font-semibold text-ink">
                        {result.startWeight !== null ? formatWeight(result.startWeight) : "Private"}
                      </p>
                    </div>
                    <div className="panel-muted p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">End</p>
                      <p className="mt-1 font-semibold text-ink">
                        {result.endWeight !== null ? formatWeight(result.endWeight) : "Private"}
                      </p>
                    </div>
                    <div className="panel-muted p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Loss</p>
                      <p className="mt-1 font-semibold text-ink">{formatWeight(result.weightLoss)}</p>
                    </div>
                    <div className="panel-muted p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Required</p>
                      <p className="mt-1 font-semibold text-ink">{formatWeight(result.requiredLossKg)}</p>
                    </div>
                    <div className="panel-muted p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Penalty</p>
                      <p className="mt-1 font-semibold text-ink">
                        {result.penaltyExempt ? "Exempt" : result.penaltyAmountRm > 0 ? formatRm(result.penaltyAmountRm) : "None"}
                      </p>
                    </div>
                  </div>

                  {result.statusDetail ? (
                    <p className="mt-4 text-sm text-ink/60">{result.statusDetail}</p>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.16em] text-ink/45">
                  <tr>
                    <th className="pb-3 font-medium">Month</th>
                    <th className="pb-3 font-medium">Start</th>
                    <th className="pb-3 font-medium">End</th>
                    <th className="pb-3 font-medium">Loss</th>
                    <th className="pb-3 font-medium">Required</th>
                    <th className="pb-3 font-medium">Penalty</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {payload.monthlyResults.map((result) => (
                    <tr key={result.id}>
                      <td className="py-3 pr-4">{getMonthLabel(result.month, result.year)}</td>
                      <td className="py-3 pr-4">
                        {result.startWeight !== null ? formatWeight(result.startWeight) : "Private"}
                      </td>
                      <td className="py-3 pr-4">
                        {result.endWeight !== null ? formatWeight(result.endWeight) : "Private"}
                      </td>
                      <td className="py-3 pr-4">{formatWeight(result.weightLoss)}</td>
                      <td className="py-3 pr-4">{formatWeight(result.requiredLossKg)}</td>
                      <td className="py-3 pr-4">
                        {result.penaltyExempt ? "Exempt" : result.penaltyAmountRm > 0 ? formatRm(result.penaltyAmountRm) : "None"}
                      </td>
                      <td className="py-3 font-semibold text-ink">
                        <p>{result.status}</p>
                        {result.statusDetail ? <p className="mt-1 text-xs font-medium text-ink/55">{result.statusDetail}</p> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
