import {
  ArrowLeft,
  CalendarBlank,
  LockSimple,
  ShieldCheck,
  Target,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppHeader, MobileBottomNav } from "@/components/app-chrome";
import { AvatarEditor } from "@/components/avatar-editor";
import { BmiMeter } from "@/components/bmi-meter";
import { CompletionRing } from "@/components/completion-ring";
import { LogWeightModal } from "@/components/log-weight-modal";
import { ParticipantPrivacyForm } from "@/components/participant-privacy-form";
import { ParticipantAvatar } from "@/components/participant-avatar";
import { PrivateStartingWeightForm } from "@/components/private-starting-weight-form";
import { ProfileTabs } from "@/components/profile-tabs";
import { ProgressBar } from "@/components/progress-bar";
import { WeightChart } from "@/components/weight-chart";
import { WeightTable } from "@/components/weight-table";
import { canParticipantLogWeight, getAppChromeUser, getUserProfilePayload } from "@/lib/data";
import { requireSession } from "@/lib/session";
import {
  formatMonthlyStatusLabel,
  formatPercentage,
  formatRm,
  formatWeight,
  getCurrentMonthPeriod,
  getMonthLabel,
  roundTo,
} from "@/lib/weight-utils";
import type {
  DashboardUserSummary,
  MonthlyStatus,
  ProfileMonthlyResult,
  TrackingDisplayMode,
} from "@/types/app";

function profileStatusClasses(status: MonthlyStatus) {
  if (status === "GOAL REACHED" || status === "PASSED") {
    return "bg-leaf/15 text-moss";
  }

  if (status === "EXEMPT") {
    return "bg-sand text-ink/70";
  }

  return "bg-blush/15 text-[#8F4A36]";
}

interface InfoCardContent {
  label: string;
  value: string;
}

function buildPrimaryStats(displayMode: TrackingDisplayMode, user: DashboardUserSummary): InfoCardContent[] {
  if (displayMode === "weight") {
    const remainingKg =
      user.currentWeight !== null && user.targetWeight !== null
        ? Math.max(roundTo(user.currentWeight - user.targetWeight, 2), 0)
        : null;

    return [
      { label: "Current", value: user.currentWeight !== null ? formatWeight(user.currentWeight) : "Not available" },
      { label: "Target", value: user.targetWeight !== null ? formatWeight(user.targetWeight) : "Not set" },
      { label: "Left", value: remainingKg !== null ? formatWeight(remainingKg) : "Not available" },
    ];
  }

  const remainingKg = user.targetLossKg !== null ? Math.max(roundTo(user.targetLossKg - user.kgLost, 2), 0) : null;

  return [
    { label: "Lost", value: formatWeight(user.kgLost) },
    { label: "Target", value: user.targetLossKg !== null ? formatWeight(user.targetLossKg) : "Not set" },
    { label: "Left", value: remainingKg !== null ? formatWeight(remainingKg) : "Not available" },
  ];
}

function buildChallengeCards(displayMode: TrackingDisplayMode, user: DashboardUserSummary): InfoCardContent[] {
  return [
    { label: "Normal monthly target", value: formatWeight(user.monthlyLossTargetKg) },
    {
      label: `${user.currentMonthTargetPct}% effective target`,
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

function getMonthProgress(user: DashboardUserSummary) {
  if (user.monthlyStatus === "EXEMPT" || user.currentMonthRequiredLossKg <= 0) {
    return 100;
  }

  return Math.max((user.currentMonthLoss / user.currentMonthRequiredLossKg) * 100, 0);
}

function StatStrip({ items }: { items: InfoCardContent[] }) {
  return (
    <dl className="grid grid-cols-3 divide-x divide-black/[0.1] border-t border-black/[0.1] pt-5">
      {items.map((item) => (
        <div className="min-w-0 px-3 first:pl-0 last:pr-0 sm:px-5" key={item.label}>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/70 sm:text-xs">{item.label}</dt>
          <dd className="mt-2 break-words text-lg font-semibold text-ink sm:text-2xl">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RuleCard({ label, value }: InfoCardContent) {
  return (
    <div className="rounded-[18px] border border-black/[0.06] bg-white/70 p-4">
      <p className="text-xs font-medium text-ink/70">{label}</p>
      <p className="mt-1.5 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function PaceSnapshot({ user }: { user: DashboardUserSummary }) {
  const paceLabel = user.currentMonthPaceUnit === "days" ? "Final stretch" : "Weekly pace";
  const paceValue =
    user.currentMonthPaceUnit === "days"
      ? `${formatWeight(user.currentMonthPaceAmountKg)} in ${user.currentMonthDaysRemaining} ${
          user.currentMonthDaysRemaining === 1 ? "day" : "days"
        }`
      : `${formatWeight(user.currentMonthPaceAmountKg)} per week`;

  return (
    <div className="mt-4 rounded-[20px] bg-sage/65 p-4">
      <p className="text-sm leading-6 text-ink/70">{user.currentMonthPaceMessage}</p>
      <dl className="mt-4 grid grid-cols-2 divide-x divide-black/[0.1]">
        <div className="pr-4">
          <dt className="text-xs text-ink/70">Weight left</dt>
          <dd className="mt-1 text-lg font-semibold">{formatWeight(user.currentMonthRemainingLossKg)}</dd>
        </div>
        <div className="pl-4">
          <dt className="text-xs text-ink/70">{paceLabel}</dt>
          <dd className="mt-1 text-lg font-semibold">{paceValue}</dd>
        </div>
      </dl>
    </div>
  );
}

function MonthlyHistory({
  monthlyResults,
}: {
  monthlyResults: ProfileMonthlyResult[];
}) {
  const successfulMonths = monthlyResults.filter(
    (result) => result.status === "PASSED" || result.status === "GOAL REACHED",
  ).length;
  const penaltyMonths = monthlyResults.filter((result) => result.penaltyAmountRm > 0).length;
  const totalPenaltyRm = monthlyResults.reduce((total, result) => total + result.penaltyAmountRm, 0);

  if (monthlyResults.length === 0) {
    return (
      <section className="rounded-[24px] bg-cream/80 p-5">
        <p className="eyebrow">Monthly results</p>
        <h2 className="mt-2 text-2xl font-semibold">Closed-month history</h2>
        <div className="mt-5 rounded-2xl border border-dashed border-black/15 px-4 py-9 text-center">
          <CalendarBlank aria-hidden className="mx-auto text-ink/35" size={30} weight="duotone" />
          <p className="mt-2 text-sm text-ink/70">No closed monthly results yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] bg-cream/80 p-5 sm:p-6" aria-labelledby="closed-month-title">
      <p className="eyebrow">Monthly results</p>
      <h2 className="mt-2 text-2xl font-semibold" id="closed-month-title">
        Closed-month history
      </h2>
      <dl className="mt-5 grid grid-cols-3 divide-x divide-black/[0.1] rounded-[18px] bg-sand/55 py-4">
        <div className="px-3 sm:px-4">
          <dt className="text-xs text-ink/70">Successful</dt>
          <dd className="mt-1 text-xl font-semibold">{successfulMonths}</dd>
        </div>
        <div className="px-3 sm:px-4">
          <dt className="text-xs text-ink/70">Missed</dt>
          <dd className="mt-1 text-xl font-semibold">{penaltyMonths}</dd>
        </div>
        <div className="px-3 sm:px-4">
          <dt className="text-xs text-ink/70">Total</dt>
          <dd className="mt-1 text-xl font-semibold">{formatRm(totalPenaltyRm)}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-3 sm:hidden">
        {monthlyResults.map((result) => (
          <article className="rounded-[20px] border border-black/[0.07] bg-white/75 p-4" key={result.id}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{getMonthLabel(result.month, result.year)}</h3>
              <span className={`status-chip ${profileStatusClasses(result.status)}`}>
                {formatMonthlyStatusLabel(result.status)}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <dt className="text-xs text-ink/70">Loss</dt>
                <dd className="mt-1 font-semibold">{formatWeight(result.weightLoss)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink/70">Target</dt>
                <dd className="mt-1 font-semibold">{formatWeight(result.requiredLossKg)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink/70">Balance</dt>
                <dd className="mt-1 font-semibold">
                  {result.penaltyExempt ? "Exempt" : result.penaltyAmountRm > 0 ? formatRm(result.penaltyAmountRm) : "None"}
                </dd>
              </div>
            </dl>
            {result.statusDetail ? <p className="mt-3 text-sm leading-6 text-ink/70">{result.statusDetail}</p> : null}
          </article>
        ))}
      </div>

      <div className="mt-5 hidden overflow-x-auto rounded-[18px] border border-black/[0.06] sm:block">
        <table className="min-w-full text-left text-sm">
          <caption className="sr-only">Closed-month target and accountability results</caption>
          <thead className="bg-sand/45 text-xs text-ink/70">
            <tr>
              <th className="px-4 py-3 font-medium" scope="col">Month</th>
              <th className="px-4 py-3 font-medium" scope="col">Loss</th>
              <th className="px-4 py-3 font-medium" scope="col">Target</th>
              <th className="px-4 py-3 font-medium" scope="col">Balance</th>
              <th className="px-4 py-3 font-medium" scope="col">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {monthlyResults.map((result) => (
              <tr key={result.id}>
                <th className="px-4 py-4 font-semibold" scope="row">{getMonthLabel(result.month, result.year)}</th>
                <td className="px-4 py-4">{formatWeight(result.weightLoss)}</td>
                <td className="px-4 py-4">{formatWeight(result.requiredLossKg)}</td>
                <td className="px-4 py-4">
                  {result.penaltyExempt ? "Exempt" : result.penaltyAmountRm > 0 ? formatRm(result.penaltyAmountRm) : "None"}
                </td>
                <td className="px-4 py-4">
                  <span className={`status-chip ${profileStatusClasses(result.status)}`}>
                    {formatMonthlyStatusLabel(result.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await requireSession();
  const { userId } = await params;
  const [payload, chromeUser] = await Promise.all([
    getUserProfilePayload(userId, session.user.id),
    getAppChromeUser(session.user.id),
  ]);

  if (!payload) {
    notFound();
  }

  const isOwnProfile = payload.user.id === session.user.id;
  const viewerCanLogWeight = session.user.isParticipant && (
    isOwnProfile
      ? !payload.user.needsStartingWeight
      : await canParticipantLogWeight(session.user.id)
  );
  const canSeePaceGuidance = isOwnProfile || session.user.isAdmin;
  const currentMonth = getCurrentMonthPeriod();
  const currentMonthLabel = getMonthLabel(currentMonth.month, currentMonth.year);
  const primaryStats = buildPrimaryStats(payload.displayMode, payload.user);
  const challengeCards = buildChallengeCards(payload.displayMode, payload.user);
  const monthProgress = getMonthProgress(payload.user);

  const overview = (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[26px] bg-cream/85 px-2 py-4 sm:px-6 sm:py-6" aria-labelledby="overall-progress-title">
        <div className="grid grid-cols-[minmax(142px,0.82fr)_minmax(0,1.18fr)] items-center gap-3 sm:grid-cols-[minmax(190px,0.82fr)_minmax(0,1.18fr)] sm:gap-6">
          <CompletionRing
            compact
            label="Goal"
            progressPct={payload.user.progressPct}
            value={payload.user.goalReached ? "Complete" : formatPercentage(payload.user.progressPct)}
          />
          <div>
            <p className="eyebrow">Progress overview</p>
            <h2 className="mt-1.5 text-xl font-semibold sm:text-3xl" id="overall-progress-title">Overall progress</h2>
            <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
              <span className={`status-chip ${profileStatusClasses(payload.user.monthlyStatus)}`}>
                {formatMonthlyStatusLabel(payload.user.monthlyStatus)}
              </span>
              {payload.user.currentMonthTargetPct !== 100 ? (
                <span className="status-chip bg-sand text-ink/70">{payload.user.currentMonthTargetPct}% target this month</span>
              ) : null}
            </div>
            <div className="mt-3 sm:mt-5">
              <StatStrip items={primaryStats} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] bg-sage/60 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">{currentMonthLabel}</p>
            <h2 className="mt-2 text-xl font-semibold">This month</h2>
          </div>
          <span className="text-lg font-semibold text-moss">{formatPercentage(monthProgress)}</span>
        </div>
        <div className="mt-4">
          <ProgressBar hidePercentage progressPct={monthProgress} title={`${currentMonthLabel} target`} />
        </div>
        <StatStrip
          items={[
            {
              label: "Lost",
              value: payload.user.currentMonthEntryCount > 0 ? formatWeight(payload.user.currentMonthLoss) : "—",
            },
            { label: "Target", value: formatWeight(payload.user.currentMonthRequiredLossKg) },
            { label: "Left", value: formatWeight(payload.user.currentMonthRemainingLossKg) },
          ]}
        />
      </section>

      <WeightChart
        mode={payload.displayMode}
        points={payload.chartPoints}
        startValue={payload.displayMode === "weight" ? payload.user.startWeight : 0}
        targetValue={payload.displayMode === "weight" ? payload.user.targetWeight : payload.user.targetLossKg}
      />
      {payload.bmi ? <BmiMeter bmi={payload.bmi} /> : null}

      <section className="rounded-[24px] bg-cream/85 p-5 sm:p-6" aria-labelledby="accountability-title">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sand text-moss">
            <Wallet aria-hidden size={23} weight="duotone" />
          </span>
          <div>
            <p className="eyebrow">Accountability</p>
            <h2 className="mt-1 text-2xl font-semibold" id="accountability-title">Balance</h2>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 divide-x divide-black/[0.1]">
          <div className="pr-5">
            <dt className="text-sm text-ink/70">Total balance</dt>
            <dd className="mt-1 text-3xl font-semibold">{formatRm(payload.user.totalRmOwed)}</dd>
          </div>
          <div className="pl-5">
            <dt className="text-sm text-ink/70">Missed-month amount</dt>
            <dd className="mt-1 text-2xl font-semibold">{formatRm(payload.user.monthlyPenaltyRm)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-ink/70">Monthly target percentages never change the normal RM penalty.</p>
      </section>
    </div>
  );

  const history = (
    <div className="space-y-5">
      <WeightTable mode={payload.displayMode} rows={payload.history} />
      <MonthlyHistory monthlyResults={payload.monthlyResults} />
    </div>
  );

  const rules = (
    <div className="space-y-5">
      <section className="rounded-[24px] bg-cream/85 p-5 sm:p-6" aria-labelledby="rules-title">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sage text-moss">
            <Target aria-hidden size={24} weight="duotone" />
          </span>
          <div>
            <p className="eyebrow">Challenge details</p>
            <h2 className="mt-1 text-2xl font-semibold" id="rules-title">Rules for {currentMonthLabel}</h2>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {challengeCards.map((card) => <RuleCard key={card.label} {...card} />)}
        </div>
        {canSeePaceGuidance ? <PaceSnapshot user={payload.user} /> : null}
      </section>

      {payload.canEditStartingWeight || payload.canManagePrivacy ? (
        <section aria-labelledby="profile-settings-title">
          <div className="mb-3 flex items-center gap-3 px-1">
            <ShieldCheck aria-hidden className="text-moss" size={22} weight="duotone" />
            <div>
              <p className="eyebrow">Settings</p>
              <h2 className="mt-1 text-xl font-semibold" id="profile-settings-title">Profile settings</h2>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {payload.canEditStartingWeight ? <PrivateStartingWeightForm currentValue={payload.user.startWeight} /> : null}
            {payload.canManagePrivacy ? <ParticipantPrivacyForm isPrivate={payload.user.isPrivate} /> : null}
          </div>
        </section>
      ) : (
        <section className="rounded-[22px] bg-sand/60 p-5">
          <p className="font-semibold">These settings are private.</p>
          <p className="mt-1 text-sm leading-6 text-ink/70">Only this participant or an admin can manage profile rules.</p>
        </section>
      )}
    </div>
  );

  return (
    <>
      <AppHeader
        currentUserId={session.user.isParticipant ? session.user.id : undefined}
        currentUserAvatarUrl={chromeUser?.avatarUrl}
        currentUserName={session.user.name ?? "Member"}
        isAdmin={session.user.isAdmin}
        isParticipant={session.user.isParticipant}
      />

      <main className="app-page pb-28 pt-3 lg:pb-10">
        <header className="mb-5 flex items-start gap-3 pt-4">
          <Link aria-label="Back to dashboard" className="icon-button mt-0.5" href="/dashboard">
            <ArrowLeft aria-hidden size={21} weight="bold" />
          </Link>
          {payload.canEditAvatar ? (
            <AvatarEditor
              avatarUrl={payload.user.avatarUrl}
              compact
              name={payload.user.name}
              targetUserId={payload.user.id}
            />
          ) : (
            <ParticipantAvatar avatarUrl={payload.user.avatarUrl} name={payload.user.name} size="lg" />
          )}
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{isOwnProfile ? "My progress" : "Participant profile"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="truncate text-3xl font-semibold sm:text-4xl">{payload.user.name}</h1>
              {payload.user.isPrivate ? (
                <span className="status-chip bg-sand text-ink/70">
                  <LockSimple aria-hidden className="mr-1" size={13} weight="bold" />
                  Private
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm text-ink/70">{payload.user.email ?? "No email linked yet"}</p>
          </div>
        </header>

        <ProfileTabs history={history} overview={overview} rules={rules} />
      </main>

      {isOwnProfile && session.user.isParticipant && !payload.user.needsStartingWeight ? (
        <LogWeightModal currentUserName={session.user.name ?? "Team member"} />
      ) : null}
      <MobileBottomNav
        active="progress"
        canLogWeight={viewerCanLogWeight}
        currentUserId={session.user.isParticipant ? session.user.id : undefined}
        currentUserName={session.user.name ?? "Member"}
        isAdmin={session.user.isAdmin}
        isParticipant={session.user.isParticipant}
      />
    </>
  );
}
