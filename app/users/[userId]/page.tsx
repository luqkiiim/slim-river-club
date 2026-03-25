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
import { formatRm, formatWeight, getCurrentMonthPeriod, getMonthLabel, roundTo } from "@/lib/weight-utils";
import type { DashboardUserSummary, MonthlyStatus } from "@/types/app";

function profileStatusClasses(status: MonthlyStatus) {
  if (status === "GOAL REACHED") {
    return "bg-leaf/15 text-moss";
  }

  if (status === "EXEMPT") {
    return "bg-sand text-ink/75";
  }

  if (status === "PASSED") {
    return "bg-[#dbe9dd] text-moss";
  }

  return "bg-blush/15 text-[#8f4a36]";
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="panel-muted h-full p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">{label}</p>
      <p className="mt-2 font-semibold text-ink">{value}</p>
    </div>
  );
}

function PrimaryStatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[26px] border border-black/5 bg-white/80 p-4 shadow-[0_16px_32px_rgba(31,42,31,0.04)]">
      <p className="text-xs uppercase tracking-[0.18em] text-ink/45">{label}</p>
      <p className="mt-3 text-3xl font-semibold [font-family:var(--font-heading)] text-ink">{value}</p>
    </div>
  );
}

interface InfoCardContent {
  label: string;
  value: string;
}

function SectionStatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="panel-muted h-full p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold [font-family:var(--font-heading)] text-ink">{value}</p>
    </div>
  );
}

function buildPrimaryStats(displayMode: "weight" | "loss", user: DashboardUserSummary): InfoCardContent[] {
  if (displayMode === "weight") {
    const remainingKg =
      user.currentWeight !== null && user.targetWeight !== null
        ? Math.max(roundTo(user.currentWeight - user.targetWeight, 2), 0)
        : null;

    return [
      {
        label: "Current",
        value: user.currentWeight !== null ? formatWeight(user.currentWeight) : "Not available",
      },
      {
        label: "Target",
        value: user.targetWeight !== null ? formatWeight(user.targetWeight) : "Not set",
      },
      {
        label: "Remaining",
        value: remainingKg !== null ? formatWeight(remainingKg) : "Not available",
      },
    ];
  }

  const remainingKg = user.targetLossKg !== null ? Math.max(roundTo(user.targetLossKg - user.kgLost, 2), 0) : null;

  return [
    {
      label: "Lost",
      value: formatWeight(user.kgLost),
    },
    {
      label: "Target",
      value: user.targetLossKg !== null ? formatWeight(user.targetLossKg) : "Not set",
    },
    {
      label: "Remaining",
      value: remainingKg !== null ? formatWeight(remainingKg) : "Not available",
    },
  ];
}

function buildChallengeCards(displayMode: "weight" | "loss", user: DashboardUserSummary): InfoCardContent[] {
  return [
    {
      label: "Monthly goal",
      value: formatWeight(user.monthlyLossTargetKg),
    },
    {
      label: "Needed this month",
      value: formatWeight(user.currentMonthRequiredLossKg),
    },
    displayMode === "weight"
      ? {
          label: "Month-end target",
          value: user.currentMonthTargetWeight !== null ? formatWeight(user.currentMonthTargetWeight) : "Not available",
        }
      : {
          label: "Tracking mode",
          value: user.needsStartingWeight ? "Baseline pending" : "Private loss-only",
        },
  ];
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

  const currentMonth = getCurrentMonthPeriod();
  const currentMonthLabel = getMonthLabel(currentMonth.month, currentMonth.year);
  const primaryStats = buildPrimaryStats(payload.displayMode, payload.user);
  const challengeCards = buildChallengeCards(payload.displayMode, payload.user);
  const successfulMonths = payload.monthlyResults.filter(
    (result) => result.status === "PASSED" || result.status === "GOAL REACHED",
  ).length;
  const exemptMonths = payload.monthlyResults.filter((result) => result.penaltyExempt).length;
  const penaltyMonths = payload.monthlyResults.filter((result) => result.penaltyAmountRm > 0).length;
  const totalPenaltyRm = payload.monthlyResults.reduce((total, result) => total + result.penaltyAmountRm, 0);

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
          <p className="mt-2 text-sm text-ink/65">{payload.user.email ?? "No email linked yet"}</p>
        </div>
        <Link className="secondary-button" href="/dashboard">
          Back to dashboard
        </Link>
      </div>

      <section className="panel mb-4 overflow-hidden p-5 sm:p-6">
        <div className="rounded-[30px] bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(248,215,167,0.3))] p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">Progress overview</p>
          <div className="mt-3 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold [font-family:var(--font-heading)] sm:text-3xl">Overall progress</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`status-chip ${profileStatusClasses(payload.user.monthlyStatus)}`}>{payload.user.monthlyStatus}</span>
                {payload.user.currentMonthTargetPct !== 100 ? (
                  <span className="status-chip bg-white text-ink/60">{payload.user.currentMonthTargetPct}% rule this month</span>
                ) : null}
                {payload.user.goalReached ? (
                  <span className="status-chip bg-leaf/15 text-moss">Goal reached</span>
                ) : null}
              </div>
            </div>

            <div className="w-full max-w-xl rounded-[26px] border border-black/5 bg-white/72 p-4 sm:p-5">
              <ProgressBar
                title={payload.displayMode === "weight" ? "Goal completion" : "Target completion"}
                progressPct={payload.user.progressPct}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {primaryStats.map((stat) => (
            <PrimaryStatCard key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      </section>

      <section className="panel p-5 sm:p-6">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">Challenge details</p>
          <h2 className="mt-1.5 text-2xl font-semibold [font-family:var(--font-heading)]">Rules for {currentMonthLabel}</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {challengeCards.map((card) => (
            <SummaryCard key={card.label} label={card.label} value={card.value} />
          ))}
        </div>
      </section>

      {payload.canEditStartingWeight || payload.canManagePrivacy ? (
        <section className="mt-6">
          <div className="mb-3 px-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">Settings</p>
            <h2 className="mt-1 text-xl font-semibold [font-family:var(--font-heading)]">Profile settings</h2>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {payload.canEditStartingWeight ? <PrivateStartingWeightForm currentValue={payload.user.startWeight} /> : null}
            {payload.canManagePrivacy ? <ParticipantPrivacyForm isPrivate={payload.user.isPrivate} /> : null}
          </div>
        </section>
      ) : null}

      <div className="mt-6 space-y-6">
        <WeightChart
          mode={payload.displayMode}
          points={payload.chartPoints}
          startValue={payload.displayMode === "weight" ? payload.user.startWeight : 0}
          targetValue={payload.displayMode === "weight" ? payload.user.targetWeight : payload.user.targetLossKg}
        />
        {payload.bmi ? <BmiMeter bmi={payload.bmi} /> : null}
        <section className="panel p-5 sm:p-6">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">Penalty summary</p>
            <h2 className="mt-1.5 text-2xl font-semibold [font-family:var(--font-heading)]">Accountability</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] bg-sand/70 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Total RM owed</p>
              <p className="mt-3 text-3xl font-semibold [font-family:var(--font-heading)]">{formatRm(payload.user.totalRmOwed)}</p>
            </div>
            <SummaryCard label="Missed-month penalty" value={formatRm(payload.user.monthlyPenaltyRm)} />
          </div>
        </section>
        <WeightTable mode={payload.displayMode} rows={payload.history} />
      </div>

      <section className="panel mt-6 overflow-hidden p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">Monthly results</p>
            <h2 className="mt-1.5 text-2xl font-semibold [font-family:var(--font-heading)]">Closed-month history</h2>
          </div>
          {payload.monthlyResults.length > 0 ? (
            <div className="rounded-full border border-black/5 bg-white/70 px-4 py-2 text-sm text-ink/60">
              {payload.monthlyResults.length} closed {payload.monthlyResults.length === 1 ? "month" : "months"}
            </div>
          ) : null}
        </div>

        {payload.monthlyResults.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/60">
            No closed monthly results yet.
          </div>
        ) : (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SectionStatCard
                label="Successful months"
                value={`${successfulMonths}`}
              />
              <SectionStatCard
                label="Exempt months"
                value={`${exemptMonths}`}
              />
              <SectionStatCard
                label="Penalty months"
                value={`${penaltyMonths}`}
              />
              <SectionStatCard
                label="Penalty total"
                value={formatRm(totalPenaltyRm)}
              />
            </div>

            <div className="space-y-4 sm:hidden">
              {payload.monthlyResults.map((result) => (
                <article key={result.id} className="rounded-[28px] border border-black/10 bg-white/85 p-4 shadow-[0_14px_28px_rgba(31,42,31,0.04)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{getMonthLabel(result.month, result.year)}</p>
                    </div>
                    <span className={`status-chip ${profileStatusClasses(result.status)}`}>{result.status}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
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
                    <div className="mt-4 rounded-[22px] bg-sand/45 px-4 py-3 text-sm text-ink/60">{result.statusDetail}</div>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-[28px] border border-black/5 bg-white/70 sm:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-sand/35 text-xs uppercase tracking-[0.16em] text-ink/45">
                  <tr>
                    <th className="px-4 py-3 font-medium">Month</th>
                    <th className="px-4 py-3 font-medium">Start</th>
                    <th className="px-4 py-3 font-medium">End</th>
                    <th className="px-4 py-3 font-medium">Loss</th>
                    <th className="px-4 py-3 font-medium">Required</th>
                    <th className="px-4 py-3 font-medium">Penalty</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {payload.monthlyResults.map((result) => (
                    <tr key={result.id} className="align-top transition hover:bg-sand/20">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-ink">{getMonthLabel(result.month, result.year)}</p>
                      </td>
                      <td className="px-4 py-4 text-ink/75">
                        {result.startWeight !== null ? formatWeight(result.startWeight) : "Private"}
                      </td>
                      <td className="px-4 py-4 text-ink/75">
                        {result.endWeight !== null ? formatWeight(result.endWeight) : "Private"}
                      </td>
                      <td className="px-4 py-4 font-semibold text-ink">{formatWeight(result.weightLoss)}</td>
                      <td className="px-4 py-4 text-ink/75">{formatWeight(result.requiredLossKg)}</td>
                      <td className="px-4 py-4">
                        {result.penaltyExempt ? "Exempt" : result.penaltyAmountRm > 0 ? formatRm(result.penaltyAmountRm) : "None"}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`status-chip ${profileStatusClasses(result.status)}`}>{result.status}</span>
                        {result.statusDetail ? <p className="mt-2 max-w-[18rem] text-xs font-medium leading-5 text-ink/55">{result.statusDetail}</p> : null}
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
