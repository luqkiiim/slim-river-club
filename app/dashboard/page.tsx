import {
  CalendarBlank,
  CaretRight,
  CheckCircle,
  Info,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { AppHeader, MobileBottomNav } from "@/components/app-chrome";
import { CompletionRing } from "@/components/completion-ring";
import { LogWeightModal } from "@/components/log-weight-modal";
import { ParticipantProgress, type ParticipantProgressUser } from "@/components/participant-progress";
import { ProgressBar } from "@/components/progress-bar";
import { getDashboardPayload } from "@/lib/data";
import { requireSession } from "@/lib/session";
import { formatPercentage, formatWeight, getCurrentAppDateAtNoon } from "@/lib/weight-utils";
import type { DashboardUserSummary, GroupSummary, MonthlyPaceStatus } from "@/types/app";

const APP_TIME_ZONE = "Asia/Kuala_Lumpur";

function getCurrentMonthProgressPct(user: DashboardUserSummary) {
  if (user.monthlyStatus === "EXEMPT" || user.currentMonthRequiredLossKg <= 0) {
    return 100;
  }

  return Math.max((user.currentMonthLoss / user.currentMonthRequiredLossKg) * 100, 0);
}

function paceStatusLabel(status: MonthlyPaceStatus) {
  if (status === "COMPLETE") return "Complete";
  if (status === "EXEMPT") return "Exempt";
  if (status === "NO_UPDATE") return "Log an update";
  if (status === "ON_TRACK") return "On pace";
  if (status === "SLIGHTLY_BEHIND") return "Nearly on pace";
  return "Needs attention";
}

function formatToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
}

function getGreeting(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-MY", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: APP_TIME_ZONE,
    }).format(now),
  );

  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function getNextWeighIn(now = new Date()) {
  const today = getCurrentAppDateAtNoon(now);
  const daysUntilSaturday = (6 - today.getUTCDay() + 7) % 7;
  const weighInDate = new Date(today);
  weighInDate.setUTCDate(today.getUTCDate() + daysUntilSaturday);

  return {
    label: daysUntilSaturday === 0 ? "Today’s weigh-in" : daysUntilSaturday === 1 ? "Tomorrow’s weigh-in" : "Next weigh-in",
    date: new Intl.DateTimeFormat("en-MY", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(weighInDate),
  };
}

function MonthHero({ user, currentMonthLabel }: { user: DashboardUserSummary; currentMonthLabel: string }) {
  const progressPct = getCurrentMonthProgressPct(user);
  const complete = user.currentMonthPaceStatus === "COMPLETE" || user.monthlyStatus === "GOAL REACHED";
  const exempt = user.monthlyStatus === "EXEMPT";
  const firstName = user.name.split(" ")[0] || user.name;
  const title = exempt ? "You’re exempt this month" : complete ? `Well done, ${firstName}!` : `${paceStatusLabel(user.currentMonthPaceStatus)}, ${firstName}`;
  const description = exempt
    ? `${currentMonthLabel} is outside your active accountability period.`
    : complete
      ? `You’ve hit your ${currentMonthLabel} target. Keep the momentum going.`
      : user.currentMonthPaceMessage;
  const ringValue = exempt ? "Exempt" : complete ? "Complete" : formatPercentage(progressPct);

  return (
    <section aria-labelledby="month-hero-title" className="mt-3 overflow-hidden rounded-[24px] bg-cream/90">
      <div className="grid grid-cols-[minmax(132px,0.78fr)_minmax(0,1.22fr)] items-center gap-3 px-2 py-3 sm:grid-cols-[minmax(190px,0.82fr)_minmax(0,1.18fr)] sm:gap-6 sm:px-5 sm:py-6">
        <CompletionRing compact label="Target" progressPct={progressPct} value={ringValue} />

        <div className="min-w-0">
          <p className="eyebrow">{currentMonthLabel}</p>
          <h2 className="mt-1 text-lg font-semibold leading-tight sm:mt-1.5 sm:text-3xl" id="month-hero-title">
            {title}
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-[18px] text-ink/70 sm:mt-1.5 sm:text-base sm:leading-7">{description}</p>

          <dl className="mt-2 grid grid-cols-3 divide-x divide-black/[0.1] border-t border-black/[0.1] pt-2 sm:mt-5 sm:pt-5">
            <MonthMetric label="This month" value={user.currentMonthEntryCount > 0 ? formatWeight(user.currentMonthLoss) : "—"} />
            <MonthMetric label="Target" value={exempt ? "Exempt" : formatWeight(user.currentMonthRequiredLossKg)} />
            <MonthMetric label="Left" value={formatWeight(user.currentMonthRemainingLossKg)} />
          </dl>
        </div>
      </div>
    </section>
  );
}

function MonthMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0 sm:px-5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink/70 sm:text-xs">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-ink sm:mt-2 sm:text-2xl">{value}</dd>
    </div>
  );
}

function WeighInPrompt({ currentUserId }: { currentUserId: string }) {
  const weighIn = getNextWeighIn();

  return (
    <section className="my-3 flex items-center gap-2.5 rounded-[22px] bg-peach/70 px-3 py-2.5 sm:my-6 sm:gap-4 sm:px-5 sm:py-4" aria-labelledby="weigh-in-title">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream/85 text-moss sm:h-14 sm:w-14">
        <CalendarBlank aria-hidden size={24} weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8F4A36]">{weighIn.label}</p>
        <h2 className="mt-0.5 truncate text-sm font-semibold sm:mt-1 sm:text-2xl" id="weigh-in-title">
          {weighIn.date}
        </h2>
        <p className="mt-0.5 truncate text-xs text-ink/70 sm:text-sm">Official weigh-in</p>
      </div>
      <Link className="secondary-button min-h-11 shrink-0 px-3 text-xs sm:px-4 sm:text-base" href={`/users/${currentUserId}`}>
        <span>See details</span>
        <CaretRight aria-hidden size={17} weight="bold" />
      </Link>
    </section>
  );
}

function GroupMomentum({ group, currentMonthLabel }: { group: GroupSummary; currentMonthLabel: string }) {
  return (
    <section
      aria-labelledby="group-momentum-title"
      className="my-3 overflow-hidden rounded-[24px] border border-black/[0.05] bg-cream/80 p-3.5 sm:my-6 sm:p-6"
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow leading-none">Group momentum</p>
          <h2 className="mt-1 text-lg font-semibold sm:mt-2 sm:text-2xl" id="group-momentum-title">
            {currentMonthLabel}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink/70 sm:mt-1 sm:text-sm">Collective monthly progress</p>
        </div>
        <p className="text-right">
          <strong className="block text-xl font-semibold sm:text-3xl">{formatWeight(group.currentMonthLoss)}</strong>
          <span className="text-[13px] text-ink/70 sm:text-sm">of {formatWeight(group.currentMonthRequiredLossKg)}</span>
        </p>
      </div>

      <div className="mt-2 sm:mt-5">
        <ProgressBar
          compact
          hidePercentage
          title="Group target progress"
          progressPct={group.currentMonthProgressPct}
        />
      </div>

      <dl className="mt-2 grid grid-cols-3 divide-x divide-black/[0.1] border-t border-black/[0.1] pt-2 sm:mt-5 sm:pt-4">
        <GroupMetric label="Members" value={`${group.totalMembers}`} />
        <GroupMetric label="Active" value={`${group.activeLoggersThisMonth}`} />
        <GroupMetric label="Progress" value={formatPercentage(group.currentMonthProgressPct)} />
      </dl>
    </section>
  );
}

function GroupMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col px-4 first:pl-0 last:pr-0">
      <dt className="order-2 mt-0.5 text-xs text-ink/70 sm:mt-1 sm:text-sm">{label}</dt>
      <dd className="order-1 text-base font-semibold sm:text-2xl">{value}</dd>
    </div>
  );
}

function SetupNotice({ userId }: { userId: string }) {
  return (
    <section className="mt-5 flex gap-3 rounded-[22px] border border-dashed border-black/15 bg-sand/70 p-4" role="status">
      <Info aria-hidden className="mt-0.5 shrink-0 text-moss" size={22} weight="bold" />
      <div>
        <p className="font-semibold">Add your starting weight to unlock progress tracking.</p>
        <p className="mt-1 text-sm leading-6 text-ink/70">
          Your earlier loss-only updates will become a private weight history once your baseline is set.
        </p>
        <Link className="mt-2 inline-flex min-h-11 items-center font-semibold text-moss underline-offset-4 hover:underline" href={`/users/${userId}`}>
          Finish profile setup
        </Link>
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const { users, groupSummary, currentMonthLabel } = await getDashboardPayload(session.user.id);
  const currentUser = users.find((user) => user.id === session.user.id);
  const participantProgressUsers: ParticipantProgressUser[] = users.map((user) => ({
    avatarUrl: user.avatarUrl,
    currentMonthLoss: user.currentMonthLoss,
    currentMonthRequiredLossKg: user.currentMonthRequiredLossKg,
    currentWeight: user.currentWeight,
    goalReached: user.goalReached,
    id: user.id,
    kgLost: user.kgLost,
    monthlyStatus: user.monthlyStatus,
    name: user.name,
    progressPct: user.progressPct,
    targetLossKg: user.targetLossKg,
    targetWeight: user.targetWeight,
    weeklyCheckInPending: user.weeklyCheckInPending,
  }));
  const currentUserNeedsSetup = Boolean(currentUser?.isPrivate && currentUser.needsStartingWeight);
  const canLogWeight = session.user.isParticipant && !currentUserNeedsSetup;

  return (
    <>
      <AppHeader
        currentUserId={currentUser?.id}
        currentUserAvatarUrl={currentUser?.avatarUrl}
        currentUserName={session.user.name ?? "Member"}
        isAdmin={session.user.isAdmin}
        isParticipant={session.user.isParticipant}
      />

      <main className="app-page pb-28 pt-0 lg:pb-10">
        <header>
          <h1 className="text-[28px] font-semibold leading-[1.08] sm:text-5xl">
            Good {getGreeting()},{" "}
            {session.user.name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-1 text-sm text-ink/70 sm:mt-2 sm:text-base">{formatToday()}</p>
        </header>

        {currentUserNeedsSetup && currentUser ? <SetupNotice userId={currentUser.id} /> : null}
        {currentUser && !currentUserNeedsSetup ? <MonthHero currentMonthLabel={currentMonthLabel} user={currentUser} /> : null}

        {currentUser && !currentUserNeedsSetup ? <WeighInPrompt currentUserId={currentUser.id} /> : null}

        <GroupMomentum currentMonthLabel={currentMonthLabel} group={groupSummary} />

        <ParticipantProgress
          activeLoggersThisMonth={groupSummary.activeLoggersThisMonth}
          currentMonthLabel={currentMonthLabel}
          emptyStateMessage={session.user.isAdmin ? "Open Admin to create the first participant." : "Your admin has not added anyone yet."}
          users={participantProgressUsers}
        />

        {currentUser?.goalReached ? (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-moss">
            <CheckCircle aria-hidden size={20} weight="fill" />
            Goal reached—keep checking in to maintain your progress.
          </p>
        ) : null}
      </main>

      {canLogWeight ? (
        <LogWeightModal currentUserName={session.user.name ?? "Team member"} />
      ) : null}
      <MobileBottomNav
        active="home"
        canLogWeight={canLogWeight}
        currentUserId={currentUser?.id}
        currentUserName={session.user.name ?? "Member"}
        isAdmin={session.user.isAdmin}
        isParticipant={session.user.isParticipant}
      />
    </>
  );
}
