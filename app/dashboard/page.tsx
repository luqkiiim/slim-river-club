import Link from "next/link";

import { LogWeightModal } from "@/components/log-weight-modal";
import { LogoutButton } from "@/components/logout-button";
import { ProgressBar } from "@/components/progress-bar";
import { UserCard } from "@/components/user-card";
import { getDashboardPayload } from "@/lib/data";
import { requireSession } from "@/lib/session";
import { formatWeight } from "@/lib/weight-utils";
import type { DashboardUserSummary, GroupSummary, MonthlyPaceStatus } from "@/types/app";

function getCurrentMonthProgressPct(user: DashboardUserSummary) {
  if (user.monthlyStatus === "EXEMPT" || user.currentMonthRequiredLossKg <= 0) {
    return 100;
  }

  return Math.max((user.currentMonthLoss / user.currentMonthRequiredLossKg) * 100, 0);
}

function paceStatusLabel(status: MonthlyPaceStatus) {
  if (status === "COMPLETE") {
    return "Complete";
  }

  if (status === "EXEMPT") {
    return "Exempt";
  }

  if (status === "NO_UPDATE") {
    return "Log update";
  }

  if (status === "ON_TRACK") {
    return "On pace";
  }

  if (status === "SLIGHTLY_BEHIND") {
    return "Close";
  }

  return "Needs pace";
}

function paceStatusClasses(status: MonthlyPaceStatus) {
  if (status === "COMPLETE" || status === "ON_TRACK") {
    return "bg-leaf/15 text-moss";
  }

  if (status === "EXEMPT") {
    return "bg-sand text-ink/75";
  }

  if (status === "SLIGHTLY_BEHIND" || status === "NO_UPDATE") {
    return "bg-[#f8d7a7] text-[#8c5b18]";
  }

  return "bg-blush/15 text-[#8f4a36]";
}

function getPaceMetric(user: DashboardUserSummary) {
  if (user.currentMonthPaceUnit === "days") {
    const daysLabel = user.currentMonthDaysRemaining === 1 ? "day" : "days";

    return {
      label: "Final stretch",
      value: `${formatWeight(user.currentMonthPaceAmountKg)} in ${user.currentMonthDaysRemaining} ${daysLabel}`,
    };
  }

  return {
    label: "Weekly pace",
    value: `${formatWeight(user.currentMonthPaceAmountKg)}/week`,
  };
}

function MyMonthPanel({ user, currentMonthLabel }: { user: DashboardUserSummary; currentMonthLabel: string }) {
  const paceMetric = getPaceMetric(user);

  return (
    <section className="panel mb-5 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">My month</p>
          <h2 className="mt-1.5 text-2xl font-semibold [font-family:var(--font-heading)]">{currentMonthLabel}</h2>
        </div>
        <span className={`status-chip ${paceStatusClasses(user.currentMonthPaceStatus)}`}>
          {paceStatusLabel(user.currentMonthPaceStatus)}
        </span>
      </div>

      <ProgressBar
        title="Monthly target"
        progressPct={getCurrentMonthProgressPct(user)}
        metrics={[
          {
            label: "This month",
            value: user.currentMonthEntryCount > 0 ? formatWeight(user.currentMonthLoss) : "No updates",
          },
          {
            label: "Target",
            value: user.monthlyStatus === "EXEMPT" ? "Exempt" : formatWeight(user.currentMonthRequiredLossKg),
          },
          {
            label: "Remaining",
            value: formatWeight(user.currentMonthRemainingLossKg),
          },
          paceMetric,
        ]}
      />

      <p className="mt-4 rounded-2xl bg-white/65 px-4 py-3 text-sm font-medium text-ink/70">{user.currentMonthPaceMessage}</p>
    </section>
  );
}

function GroupStatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel-muted p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold [font-family:var(--font-heading)] text-ink">{value}</p>
    </div>
  );
}

function GroupMomentumPanel({ groupSummary, currentMonthLabel }: { groupSummary: GroupSummary; currentMonthLabel: string }) {
  return (
    <section className="panel mb-5 p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">Group momentum</p>
        <h2 className="mt-1.5 text-2xl font-semibold [font-family:var(--font-heading)]">{currentMonthLabel}</h2>
      </div>

      <ProgressBar
        title="Collective monthly progress"
        progressPct={groupSummary.currentMonthProgressPct}
        metrics={[
          {
            label: "Logged",
            value:
              groupSummary.currentMonthRequiredLossKg > 0
                ? `${formatWeight(groupSummary.currentMonthLoss)} / ${formatWeight(groupSummary.currentMonthRequiredLossKg)}`
                : "No active target",
          },
          {
            label: "Active",
            value: `${groupSummary.activeLoggersThisMonth}/${groupSummary.totalMembers}`,
          },
        ]}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GroupStatCard label="Members" value={groupSummary.totalMembers} />
        <GroupStatCard label="Logged this month" value={groupSummary.activeLoggersThisMonth} />
        <GroupStatCard label="Goals reached" value={groupSummary.goalReachedCount} />
        <GroupStatCard label="Group kg lost" value={formatWeight(groupSummary.totalKgLost)} />
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const { users, groupSummary, currentMonthLabel } = await getDashboardPayload(session.user.id);
  const currentUser = users.find((user) => user.id === session.user.id);
  const currentUserNeedsSetup = Boolean(currentUser?.isPrivate && currentUser.needsStartingWeight);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 pb-28 sm:px-6 sm:py-6">
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">Dashboard</p>
          <div>
            <h1 className="text-3xl font-semibold [font-family:var(--font-heading)] sm:text-4xl">Slim River Club</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-ink/70">
              {session.user.isParticipant
                ? `Welcome back, ${session.user.name}.`
                : `Welcome back, ${session.user.name}. This account can manage the club without joining the tracked roster.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {session.user.isAdmin ? (
            <Link className="secondary-button" href="/admin">
              Admin
            </Link>
          ) : null}
          <LogoutButton />
        </div>
      </header>

      {currentUserNeedsSetup ? (
        <section className="panel mb-5 border border-dashed border-black/10 p-4 sm:p-5">
          <p className="text-sm font-semibold text-ink">Private profile setup is waiting on your starting weight.</p>
          <p className="mt-1.5 text-sm text-ink/65">
            Once you add it on your profile page, the earlier loss-only updates from your admin will become a full private weight history.
          </p>
          <Link className="mt-3 inline-flex text-sm font-semibold text-moss underline-offset-4 hover:underline" href={`/users/${session.user.id}`}>
            Open my profile
          </Link>
        </section>
      ) : null}

      {currentUser && !currentUserNeedsSetup ? <MyMonthPanel user={currentUser} currentMonthLabel={currentMonthLabel} /> : null}

      <GroupMomentumPanel groupSummary={groupSummary} currentMonthLabel={currentMonthLabel} />

      <section className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">{currentMonthLabel}</p>
          <h2 className="mt-1.5 text-2xl font-semibold [font-family:var(--font-heading)]">Participants</h2>
        </div>
      </section>

      <section className="grid gap-3.5 lg:grid-cols-2">
        {users.length === 0 ? (
          <div className="panel rounded-3xl border border-dashed border-black/10 px-6 py-10 text-center text-sm text-ink/60 lg:col-span-2">
            No participant accounts yet.
          </div>
        ) : (
          users.map((user) => (
            <UserCard key={user.id} user={user} currentMonthLabel={currentMonthLabel} isCurrentUser={user.id === session.user.id} />
          ))
        )}
      </section>

      {session.user.isParticipant && !currentUserNeedsSetup ? (
        <LogWeightModal currentUserName={session.user.name ?? "Team member"} />
      ) : null}
    </main>
  );
}
