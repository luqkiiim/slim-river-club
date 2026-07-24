import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { CompletionRing } from "@/components/completion-ring";
import { formatWeight } from "@/lib/weight-utils";
import type { DashboardUserSummary } from "@/types/app";

interface UserCardProps {
  user: DashboardUserSummary;
  currentMonthLabel: string;
  isCurrentUser?: boolean;
}

export function UserCard({ user, currentMonthLabel }: UserCardProps) {
  const progressPct = user.monthlyStatus === "EXEMPT" || user.currentMonthRequiredLossKg <= 0
    ? 100
    : Math.max((user.currentMonthLoss / user.currentMonthRequiredLossKg) * 100, 0);
  const progressValue = user.monthlyStatus === "EXEMPT"
    ? "Exempt"
    : `${formatWeight(user.currentMonthLoss).replace(" kg", "")} / ${formatWeight(user.currentMonthRequiredLossKg)}`;

  return (
    <article className="border-b border-black/[0.08] last:border-b-0">
      <Link className="group flex min-h-[76px] items-center gap-3 py-3.5" href={`/users/${user.id}`}>
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
            {user.personalBest ? <span className="status-chip bg-[#F8D7A7] text-[#8C5B18]">Personal best</span> : null}
          </span>
          <span className="mt-1 block truncate text-sm font-medium text-ink/70">{progressValue}</span>
        </span>

        <CompletionRing
          mini
          label={`${currentMonthLabel} progress`}
          progressPct={progressPct}
          value={user.monthlyStatus === "EXEMPT" ? "—" : `${Math.round(Math.min(progressPct, 100))}%`}
        />
        <CaretRight aria-hidden className="shrink-0 text-ink/70 transition group-hover:translate-x-0.5 group-hover:text-moss" size={20} />
      </Link>
    </article>
  );
}
