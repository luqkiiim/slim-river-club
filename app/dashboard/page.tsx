import Link from "next/link";

import { Leaderboard } from "@/components/leaderboard";
import { LogWeightModal } from "@/components/log-weight-modal";
import { LogoutButton } from "@/components/logout-button";
import { UserCard } from "@/components/user-card";
import { getDashboardPayload } from "@/lib/data";
import { requireSession } from "@/lib/session";
import { formatRm, formatWeight } from "@/lib/weight-utils";

export default async function DashboardPage() {
  const session = await requireSession();
  const { users, groupSummary, lossLeaderboard, progressLeaderboard, currentMonthLabel } = await getDashboardPayload(
    session.user.id,
  );
  const currentUser = users.find((user) => user.id === session.user.id);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 pb-28 sm:px-6 sm:py-6">
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">Dashboard</p>
          <div>
            <h1 className="text-3xl font-semibold [font-family:var(--font-heading)] sm:text-4xl">Slim River Club</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-ink/70">
              {session.user.isParticipant
                ? `Welcome back, ${session.user.name}. Monthly progress already reflects each participant's own rules and any active month discount.`
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

      {currentUser?.isPrivate && currentUser.needsStartingWeight ? (
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

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Members</p>
          <p className="mt-2 text-3xl font-semibold [font-family:var(--font-heading)]">{groupSummary.totalMembers}</p>
        </div>
        <div className="panel p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Goals reached</p>
          <p className="mt-2 text-3xl font-semibold [font-family:var(--font-heading)]">{groupSummary.goalReachedCount}</p>
        </div>
        <div className="panel p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Group kg lost</p>
          <p className="mt-2 text-3xl font-semibold [font-family:var(--font-heading)]">{formatWeight(groupSummary.totalKgLost)}</p>
        </div>
        <div className="panel p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Total RM owed</p>
          <p className="mt-2 text-3xl font-semibold [font-family:var(--font-heading)]">{formatRm(groupSummary.totalRmOwed)}</p>
        </div>
      </section>

      <section className="mb-5">
        <Leaderboard lossLeaderboard={lossLeaderboard} progressLeaderboard={progressLeaderboard} />
      </section>

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
          users.map((user) => <UserCard key={user.id} user={user} currentMonthLabel={currentMonthLabel} />)
        )}
      </section>

      {session.user.isParticipant && !(currentUser?.isPrivate && currentUser.needsStartingWeight) ? (
        <LogWeightModal currentUserName={session.user.name ?? "Team member"} />
      ) : null}
    </main>
  );
}
