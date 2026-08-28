"use client";

import { CaretRight, Target, TrendUp } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { CompletionRing } from "@/components/completion-ring";
import { ParticipantAvatar } from "@/components/participant-avatar";
import { formatWeight } from "@/lib/weight-utils";
import type { MonthlyStatus } from "@/types/app";

type ProgressView = "month" | "overall";

export interface ParticipantProgressUser {
  avatarUrl: string | null;
  currentMonthLoss: number;
  currentMonthRequiredLossKg: number;
  currentWeight: number | null;
  goalReached: boolean;
  id: string;
  kgLost: number;
  monthlyStatus: MonthlyStatus;
  name: string;
  progressPct: number;
  targetLossKg: number | null;
  targetWeight: number | null;
  weeklyCheckInPending: boolean;
}

interface ParticipantProgressProps {
  activeLoggersThisMonth: number;
  currentMonthLabel: string;
  emptyStateMessage: string;
  users: ParticipantProgressUser[];
}

function getMonthlyProgress(user: ParticipantProgressUser) {
  if (user.monthlyStatus === "EXEMPT" || user.currentMonthRequiredLossKg <= 0) {
    return 100;
  }

  return Math.max((user.currentMonthLoss / user.currentMonthRequiredLossKg) * 100, 0);
}

function ParticipantProgressRow({
  currentMonthLabel,
  user,
  view,
}: {
  currentMonthLabel: string;
  user: ParticipantProgressUser;
  view: ProgressView;
}) {
  const isMonthlyView = view === "month";
  const monthlyProgress = getMonthlyProgress(user);
  const targetLossKg = user.targetLossKg;
  const hasOverallGoal = targetLossKg !== null;
  const progressPct = isMonthlyView ? monthlyProgress : user.progressPct;
  const progressValue = isMonthlyView
    ? user.monthlyStatus === "EXEMPT"
      ? "Exempt"
      : `${formatWeight(user.currentMonthLoss).replace(" kg", "")} / ${formatWeight(user.currentMonthRequiredLossKg)}`
    : user.goalReached
      ? `Goal reached · ${formatWeight(user.kgLost)} lost`
      : hasOverallGoal
        ? `${formatWeight(user.kgLost)} / ${formatWeight(targetLossKg)}`
        : `${formatWeight(user.kgLost)} lost overall`;
  const weightProgressValue =
    user.currentWeight !== null && user.targetWeight !== null
      ? `${formatWeight(user.currentWeight).replace(" kg", "")} / ${formatWeight(user.targetWeight)}`
      : null;

  return (
    <article className="border-b border-black/[0.08] last:border-b-0">
      <Link className="group flex min-h-[76px] items-center gap-3 py-3.5" href={`/users/${user.id}`}>
        <ParticipantAvatar
          avatarUrl={user.avatarUrl}
          name={user.name}
          pendingCheckIn={user.weeklyCheckInPending}
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-ink">{user.name}</span>
          <span
            className={`mt-1 min-w-0 overflow-hidden text-[13px] font-medium text-ink/70 sm:text-sm ${
              isMonthlyView && weightProgressValue
                ? "grid grid-cols-[minmax(0,0.9fr)_1px_minmax(0,1.1fr)] items-center gap-x-2"
                : "block truncate"
            }`}
          >
            <span className="min-w-0 truncate whitespace-nowrap tabular-nums">
              <span className="sr-only">{isMonthlyView ? "Monthly loss: " : "Overall progress: "}</span>
              {progressValue}
            </span>
            {isMonthlyView && weightProgressValue ? (
              <>
                <span aria-hidden className="h-4 w-px shrink-0 bg-black/15" />
                <span className="min-w-0 truncate whitespace-nowrap tabular-nums">
                  <span className="sr-only">Current and target weight: </span>
                  {weightProgressValue}
                </span>
              </>
            ) : null}
          </span>
        </span>

        {!isMonthlyView && !hasOverallGoal ? (
          <span
            aria-label="Overall goal not set"
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-[6px] border-sage text-center text-[10px] font-semibold leading-tight text-ink/70"
          >
            No goal
          </span>
        ) : (
          <CompletionRing
            mini
            label={isMonthlyView ? `${currentMonthLabel} progress` : "Overall goal progress"}
            progressPct={progressPct}
            value={
              isMonthlyView && user.monthlyStatus === "EXEMPT"
                ? "—"
                : !isMonthlyView && user.goalReached
                  ? "Done"
                  : `${Math.round(Math.min(progressPct, 100))}%`
            }
          />
        )}
        <CaretRight aria-hidden className="shrink-0 text-ink/70 transition group-hover:translate-x-0.5 group-hover:text-moss" size={20} />
      </Link>
    </article>
  );
}

export function ParticipantProgress({
  activeLoggersThisMonth,
  currentMonthLabel,
  emptyStateMessage,
  users,
}: ParticipantProgressProps) {
  const [view, setView] = useState<ProgressView>("month");
  const isMonthlyView = view === "month";

  return (
    <section className="scroll-mt-5 rounded-[24px] bg-cream/80 px-4 py-4 sm:px-6 sm:py-5" id="participants" aria-labelledby="participants-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Participant activity</p>
          <h2 className="mt-1 text-xl font-semibold sm:mt-2 sm:text-2xl" id="participants-title">
            {isMonthlyView ? "The club this month" : "Overall progress"}
          </h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          {users.some((user) => user.weeklyCheckInPending) ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-ink/70">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#C94735]" />
              Check-in due
            </span>
          ) : null}
          <span className="hidden items-center gap-1 text-sm font-medium text-moss sm:flex">
            <TrendUp aria-hidden size={18} weight="bold" />
            {activeLoggersThisMonth} active
          </span>
        </div>
      </div>

      <div
        aria-label="Participant progress period"
        className="mt-4 grid grid-cols-2 rounded-[16px] bg-sand/70 p-1"
        role="group"
      >
        <button
          aria-pressed={isMonthlyView}
          className={`min-h-11 rounded-[12px] px-3 text-sm font-semibold transition ${
            isMonthlyView ? "bg-white text-moss shadow-sm" : "text-ink/70 hover:text-ink"
          }`}
          onClick={() => setView("month")}
          type="button"
        >
          This month
        </button>
        <button
          aria-pressed={!isMonthlyView}
          className={`min-h-11 rounded-[12px] px-3 text-sm font-semibold transition ${
            !isMonthlyView ? "bg-white text-moss shadow-sm" : "text-ink/70 hover:text-ink"
          }`}
          onClick={() => setView("overall")}
          type="button"
        >
          Overall
        </button>
      </div>

      <div className="mt-2">
        {users.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 px-5 py-10 text-center">
            <Target aria-hidden className="mx-auto text-ink/35" size={30} weight="duotone" />
            <p className="mt-3 font-semibold">No participant profiles yet</p>
            <p className="mt-1 text-sm text-ink/70">{emptyStateMessage}</p>
          </div>
        ) : (
          users.map((user) => (
            <ParticipantProgressRow
              currentMonthLabel={currentMonthLabel}
              key={user.id}
              user={user}
              view={view}
            />
          ))
        )}
      </div>
    </section>
  );
}
