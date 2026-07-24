import { CaretRight, LockSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { formatMonthlyStatusLabel, formatWeight } from "@/lib/weight-utils";
import type { DashboardUserSummary, MonthlyStatus } from "@/types/app";

interface UserCardProps {
  user: DashboardUserSummary;
  currentMonthLabel: string;
  isCurrentUser?: boolean;
}

function statusClasses(status: MonthlyStatus) {
  if (status === "GOAL REACHED" || status === "PASSED") {
    return "text-moss";
  }

  if (status === "EXEMPT") {
    return "text-ink/70";
  }

  return "text-[#8F4A36]";
}

function formatPace(user: DashboardUserSummary) {
  if (user.currentMonthPaceUnit === "days") {
    const daysLabel = user.currentMonthDaysRemaining === 1 ? "day" : "days";

    return `${formatWeight(user.currentMonthPaceAmountKg)} in ${user.currentMonthDaysRemaining} ${daysLabel}`;
  }

  return `${formatWeight(user.currentMonthPaceAmountKg)} per week`;
}

export function UserCard({ user, currentMonthLabel, isCurrentUser = false }: UserCardProps) {
  const activity = user.currentMonthEntryCount > 0
    ? `${formatWeight(user.currentMonthLoss)} this month${user.lastLoggedAt ? ` · updated ${user.lastLoggedAt}` : ""}`
    : `No ${currentMonthLabel} update yet`;

  return (
    <article className="border-b border-black/[0.08] last:border-b-0">
      <Link
        className="group flex min-h-[76px] items-center gap-3 py-3.5"
        href={`/users/${user.id}`}
      >
        <span
          aria-hidden
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-semibold ${
            user.personalBest ? "bg-peach text-[#9A4F39]" : "bg-sage text-moss"
          }`}
        >
          {user.name.slice(0, 1).toUpperCase()}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-ink">{user.name}</span>
            {user.isPrivate ? (
              <span className="status-chip bg-sand text-ink/70">
                <LockSimple aria-hidden className="mr-1" size={13} weight="bold" />
                Private
              </span>
            ) : null}
            {user.personalBest ? (
              <span className="status-chip bg-[#F8D7A7] text-[#8C5B18]">Personal best</span>
            ) : null}
          </span>
          <span className="mt-1 block truncate text-sm text-ink/70">{activity}</span>
          {isCurrentUser && user.currentMonthRemainingLossKg > 0 ? (
            <span className="mt-1 block text-xs font-semibold text-moss">Your pace: {formatPace(user)}</span>
          ) : null}
          {user.currentMonthTargetPct !== 100 ? (
            <span className="mt-1 block text-xs text-ink/70">{user.currentMonthTargetPct}% effective target this month</span>
          ) : null}
        </span>

        <span className="shrink-0 text-right">
          <span className={`block text-sm font-medium ${statusClasses(user.monthlyStatus)}`}>
            {formatMonthlyStatusLabel(user.monthlyStatus)}
          </span>
          <span className="mt-1 hidden text-xs font-semibold text-moss sm:block">View profile</span>
        </span>
        <CaretRight aria-hidden className="shrink-0 text-ink/70 transition group-hover:translate-x-0.5 group-hover:text-moss" size={20} />
      </Link>
    </article>
  );
}
