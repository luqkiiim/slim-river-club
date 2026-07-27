import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { CompletionRing } from "@/components/completion-ring";
import { ParticipantAvatar } from "@/components/participant-avatar";
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
        <ParticipantAvatar
          avatarUrl={user.avatarUrl}
          name={user.name}
          pendingCheckIn={user.weeklyCheckInPending}
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-ink">{user.name}</span>
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
