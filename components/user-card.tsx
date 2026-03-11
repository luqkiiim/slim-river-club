import Link from "next/link";

import { ProgressBar } from "@/components/progress-bar";
import { formatWeight } from "@/lib/weight-utils";
import type { DashboardUserSummary, MonthlyStatus } from "@/types/app";

interface UserCardProps {
  user: DashboardUserSummary;
  currentMonthLabel: string;
}

function statusClasses(status: MonthlyStatus) {
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

function getCurrentMonthProgressPct(user: DashboardUserSummary) {
  if (user.monthlyStatus === "EXEMPT") {
    return 100;
  }

  if (user.currentMonthRequiredLossKg <= 0) {
    return 100;
  }

  return Math.max((user.currentMonthLoss / user.currentMonthRequiredLossKg) * 100, 0);
}

function buildMonthlyProgressContent(user: DashboardUserSummary, currentMonthLabel: string) {
  return {
    title: `${currentMonthLabel} progress`,
    progressPct: getCurrentMonthProgressPct(user),
    metrics: [
      {
        label: "Lost",
        value: user.currentMonthEntryCount > 0 ? formatWeight(user.currentMonthLoss) : "No updates yet",
      },
      {
        label: "Required",
        value: user.monthlyStatus === "EXEMPT" ? "Exempt" : formatWeight(user.currentMonthRequiredLossKg),
      },
    ] as const,
  };
}

export function UserCard({ user, currentMonthLabel }: UserCardProps) {
  const progressContent = buildMonthlyProgressContent(user, currentMonthLabel);
  const targetText =
    user.displayMode === "weight" && user.targetWeight !== null
      ? `Target ${formatWeight(user.targetWeight)}`
      : user.targetLossKg !== null
        ? `Target ${formatWeight(user.targetLossKg)} loss`
        : "Target not set";
  const lastLoggedText = user.lastLoggedAt
    ? `Last logged ${user.lastLoggedAt}`
    : user.displayMode === "weight"
      ? "No weigh-ins yet"
      : "No progress updates yet";

  return (
    <article className="panel p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold [font-family:var(--font-heading)] sm:text-xl">{user.name}</h3>
            {user.isPrivate ? (
              <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-semibold text-ink/70">Private</span>
            ) : null}
            {user.personalBest ? (
              <span className="rounded-full bg-[#f8d7a7] px-2.5 py-1 text-[11px] font-semibold text-[#8c5b18]">
                New Personal Best
              </span>
            ) : null}
          </div>
        </div>
        <span className={`status-chip ${statusClasses(user.monthlyStatus)}`}>{user.monthlyStatus}</span>
      </div>

      <ProgressBar title={progressContent.title} progressPct={progressContent.progressPct} metrics={progressContent.metrics} />

      <div className="mt-4 grid grid-cols-2 gap-2.5 text-sm">
        <div className="panel-muted p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
            {user.displayMode === "weight" ? "Current" : "Total lost"}
          </p>
          <p className="mt-2 font-semibold text-ink">
            {user.displayMode === "weight" && user.currentWeight !== null ? formatWeight(user.currentWeight) : formatWeight(user.kgLost)}
          </p>
        </div>
        <div className="panel-muted p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
            {user.displayMode === "weight" ? "Lost" : "Target loss"}
          </p>
          <p className="mt-2 font-semibold text-ink">
            {user.displayMode === "weight"
              ? formatWeight(user.kgLost)
              : user.targetLossKg !== null
                ? formatWeight(user.targetLossKg)
                : "Not set"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5 border-t border-black/5 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/60">
          <p>{targetText}</p>
          <span className="hidden text-ink/35 sm:inline">•</span>
          <p>{lastLoggedText}</p>
          {user.currentMonthTargetPct !== 100 ? <p>{user.currentMonthTargetPct}% month rule</p> : null}
        </div>
        <Link className="text-sm font-semibold text-moss underline-offset-4 hover:underline" href={`/users/${user.id}`}>
          View profile
        </Link>
      </div>
    </article>
  );
}
