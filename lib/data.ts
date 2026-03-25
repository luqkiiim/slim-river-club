import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  MONTHLY_LOSS_TARGET_KG,
  RM_PENALTY,
  buildResolvedWeightTimeline,
  calculateBmi,
  calculateLossProgress,
  calculateProgress,
  didReachTargetLossByDate,
  formatDate,
  formatWeight,
  getBmiCategory,
  getClosedMonthPeriods,
  getCurrentMonthLoss,
  getCurrentMonthPeriod,
  getCurrentWeight,
  getLatestResolvedWeightBefore,
  getLatestResolvedWeightOnOrBefore,
  getLatestTotalKgLost,
  getMonthLabel,
  getMonthlyStatus,
  getRequiredLossKg,
  getTotalKgLostBefore,
  getTotalKgLostOnOrBefore,
  isLatestWeightPersonalBest,
  roundTo,
  sortByLeaderboardMetric,
  type ResolvedWeightEntry,
} from "@/lib/weight-utils";
import type {
  AdminEntrySummary,
  AdminUserSummary,
  BmiSummary,
  DashboardUserSummary,
  GroupSummary,
  LeaderboardRow,
  MonthPolicySummary,
  ProfileHistoryRow,
  ProfileMonthlyResult,
  TrackingDisplayMode,
  UserProfilePayload,
} from "@/types/app";

type DbClient = PrismaClient | Prisma.TransactionClient;

type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    weightEntries: {
      orderBy: [{ date: "asc" }, { createdAt: "asc" }];
    };
    monthlyResults: {
      orderBy: [{ year: "desc" }, { month: "desc" }];
    };
  };
}>;

type ParticipantUserWithRelations = UserWithRelations;
type MonthPolicyRecord = Pick<MonthPolicySummary, "month" | "year" | "requiredTargetPct">;
type MonthPolicyMap = Map<string, MonthPolicyRecord>;

interface TrackingState {
  displayMode: TrackingDisplayMode;
  timeline: ResolvedWeightEntry[];
  targetLossKg: number | null;
  monthlyLossTargetKg: number;
  monthlyPenaltyRm: number;
  challengeStartDate: Date;
  targetWeight: number | null;
  currentWeight: number | null;
  kgLost: number;
  progressPct: number;
  goalReached: boolean;
  currentMonthLoss: number;
}

function isParticipantUser<T extends { isParticipant: boolean }>(user: T): user is T & { isParticipant: true } {
  return user.isParticipant;
}

function getEffectiveChallengeStartDate(
  user: Pick<UserWithRelations, "challengeStartDate" | "createdAt"> & { weightEntries: Array<{ date: Date }> },
) {
  if (user.challengeStartDate !== null) {
    return user.challengeStartDate;
  }

  const earliestEntryDate = user.weightEntries[0]?.date;

  if (!earliestEntryDate) {
    return user.createdAt;
  }

  return earliestEntryDate.getTime() < user.createdAt.getTime() ? earliestEntryDate : user.createdAt;
}

function isSameUtcMonth(date: Date, month: number, year: number) {
  return date.getUTCMonth() + 1 === month && date.getUTCFullYear() === year;
}

function buildMonthPolicyKey(month: number, year: number) {
  return `${year}-${month}`;
}

function buildMonthPolicyMap(policies: MonthPolicyRecord[]) {
  return new Map(policies.map((policy) => [buildMonthPolicyKey(policy.month, policy.year), policy]));
}

function getTargetRatioPctForPeriod(policies: MonthPolicyMap, period: { month: number; year: number }) {
  return policies.get(buildMonthPolicyKey(period.month, period.year))?.requiredTargetPct ?? 100;
}

function isPenaltyExemptPeriod(challengeStartDate: Date, period: { month: number; year: number }) {
  return challengeStartDate.getUTCDate() !== 1 && isSameUtcMonth(challengeStartDate, period.month, period.year);
}

function getEffectiveTargetLoss(user: Pick<UserWithRelations, "startWeight" | "targetWeight" | "targetLossKg">) {
  if (user.targetLossKg !== null) {
    return user.targetLossKg;
  }

  if (user.startWeight !== null && user.targetWeight !== null) {
    return roundTo(user.startWeight - user.targetWeight, 2);
  }

  return null;
}

function getEffectiveTargetWeight(user: Pick<UserWithRelations, "startWeight" | "targetWeight" | "targetLossKg">) {
  if (user.targetWeight !== null) {
    return user.targetWeight;
  }

  if (user.startWeight !== null && user.targetLossKg !== null) {
    return roundTo(user.startWeight - user.targetLossKg, 2);
  }

  return null;
}

function getDisplayMode(user: Pick<UserWithRelations, "id" | "isPrivate" | "startWeight">, viewerUserId?: string): TrackingDisplayMode {
  if (user.isPrivate && user.id !== viewerUserId) {
    return "loss";
  }

  return user.startWeight !== null ? "weight" : "loss";
}

function buildTrackingState(user: ParticipantUserWithRelations, viewerUserId?: string): TrackingState {
  const timeline = buildResolvedWeightTimeline(user.startWeight, user.weightEntries);
  const targetLossKg = getEffectiveTargetLoss(user);
  const monthlyLossTargetKg = user.monthlyLossTargetKg ?? MONTHLY_LOSS_TARGET_KG;
  const monthlyPenaltyRm = user.monthlyPenaltyRm ?? RM_PENALTY;
  const challengeStartDate = getEffectiveChallengeStartDate(user);
  const targetWeight = getEffectiveTargetWeight(user);
  const currentWeight = getCurrentWeight(user.startWeight, timeline);
  const kgLost = getLatestTotalKgLost(timeline);
  const progressPct =
    targetLossKg !== null
      ? calculateLossProgress(kgLost, targetLossKg)
      : user.startWeight !== null && currentWeight !== null && targetWeight !== null
        ? calculateProgress(user.startWeight, currentWeight, targetWeight)
        : 0;
  const goalReached =
    targetLossKg !== null
      ? kgLost >= targetLossKg
      : currentWeight !== null && targetWeight !== null
        ? currentWeight <= targetWeight
        : false;
  const currentMonthLoss = getCurrentMonthLoss(timeline, getCurrentMonthPeriod());

  return {
    displayMode: getDisplayMode(user, viewerUserId),
    timeline,
    targetLossKg,
    monthlyLossTargetKg,
    monthlyPenaltyRm,
    challengeStartDate,
    targetWeight,
    currentWeight,
    kgLost,
    progressPct,
    goalReached,
    currentMonthLoss,
  };
}

function goalReachedByPeriodEnd(
  targetLossKg: number | null,
  timeline: ResolvedWeightEntry[],
  periodEnd: Date,
) {
  if (targetLossKg === null) {
    return false;
  }

  return didReachTargetLossByDate(timeline, targetLossKg, periodEnd);
}

function buildBmiSummary(
  user: Pick<UserWithRelations, "isPrivate" | "heightCm" | "startWeight">,
  tracking: Pick<TrackingState, "displayMode" | "currentWeight" | "targetWeight">,
): BmiSummary | null {
  if (tracking.displayMode !== "weight") {
    return null;
  }

  const heightCm = user.heightCm;
  const startBmi = user.startWeight !== null && heightCm !== null ? calculateBmi(user.startWeight, heightCm) : null;
  const currentBmi = tracking.currentWeight !== null && heightCm !== null ? calculateBmi(tracking.currentWeight, heightCm) : null;
  const targetBmi = tracking.targetWeight !== null && heightCm !== null ? calculateBmi(tracking.targetWeight, heightCm) : null;

  return {
    heightCm,
    startBmi,
    currentBmi,
    targetBmi,
    category: getBmiCategory(currentBmi),
  };
}

function getHistoricalMonthlyStatus(
  penaltyExempt: boolean,
  goalReachedAtMonthEnd: boolean,
  penaltyApplied: boolean,
): ProfileMonthlyResult["status"] {
  if (penaltyExempt) {
    return "EXEMPT";
  }

  if (goalReachedAtMonthEnd) {
    return "GOAL REACHED";
  }

  return penaltyApplied ? "NEEDS MORE LOSS" : "PASSED";
}

function buildDashboardUser(
  user: ParticipantUserWithRelations,
  monthPolicies: MonthPolicyMap,
  viewerUserId?: string,
): DashboardUserSummary {
  const tracking = buildTrackingState(user, viewerUserId);
  const currentMonth = getCurrentMonthPeriod();
  const currentMonthTargetPct = getTargetRatioPctForPeriod(monthPolicies, currentMonth);
  const currentMonthRequiredLossKg = getRequiredLossKg(tracking.monthlyLossTargetKg, currentMonthTargetPct);
  const currentMonthStartWeight =
    tracking.displayMode === "weight"
      ? getLatestResolvedWeightBefore(tracking.timeline, currentMonth.start) ?? user.startWeight
      : null;
  const currentMonthTargetWeight =
    currentMonthStartWeight !== null ? roundTo(currentMonthStartWeight - currentMonthRequiredLossKg, 2) : null;
  const currentMonthEntries = user.weightEntries.filter(
    (entry) => entry.date.getTime() >= currentMonth.start.getTime() && entry.date.getTime() <= currentMonth.end.getTime(),
  );
  const monthlyStatus = isPenaltyExemptPeriod(tracking.challengeStartDate, currentMonth)
    ? "EXEMPT"
    : getMonthlyStatus(tracking.goalReached, tracking.currentMonthLoss, currentMonthRequiredLossKg);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isPrivate: user.isPrivate,
    displayMode: tracking.displayMode,
    heightCm: user.heightCm,
    startWeight: tracking.displayMode === "weight" ? user.startWeight : null,
    currentWeight: tracking.displayMode === "weight" ? tracking.currentWeight : null,
    targetWeight: tracking.displayMode === "weight" ? tracking.targetWeight : null,
    targetLossKg: tracking.targetLossKg,
    monthlyLossTargetKg: tracking.monthlyLossTargetKg,
    currentMonthRequiredLossKg,
    currentMonthTargetWeight,
    currentMonthTargetPct,
    monthlyPenaltyRm: tracking.monthlyPenaltyRm,
    challengeStartDateIso: tracking.challengeStartDate.toISOString(),
    kgLost: tracking.kgLost,
    progressPct: tracking.progressPct,
    totalRmOwed: user.totalRmOwed,
    goalReached: tracking.goalReached,
    monthlyStatus,
    currentMonthLoss: tracking.currentMonthLoss,
    currentMonthEntryCount: currentMonthEntries.length,
    personalBest: isLatestWeightPersonalBest(tracking.timeline),
    needsStartingWeight: user.isPrivate && user.startWeight === null,
    lastLoggedAt: user.weightEntries.at(-1) ? formatDate(user.weightEntries.at(-1)!.date) : undefined,
  };
}

function buildLeaderboard(users: DashboardUserSummary[], metric: "kgLost" | "progressPct"): LeaderboardRow[] {
  return [...users]
    .sort((a, b) => sortByLeaderboardMetric(a, b, metric))
    .map((user) => ({
      userId: user.id,
      name: user.name,
      metric: user[metric],
      valueLabel: metric === "kgLost" ? formatWeight(user[metric]) : `${user[metric]}%`,
    }));
}

function buildGroupSummary(users: DashboardUserSummary[]): GroupSummary {
  return {
    totalMembers: users.length,
    goalReachedCount: users.filter((user) => user.goalReached).length,
    totalKgLost: roundTo(users.reduce((total, user) => total + user.kgLost, 0), 2),
    totalRmOwed: users.reduce((total, user) => total + user.totalRmOwed, 0),
  };
}

async function upsertMonthlyResultsForUser(user: ParticipantUserWithRelations, monthPolicies: MonthPolicyMap, db: DbClient) {
  const challengeStartDate = getEffectiveChallengeStartDate(user);
  const periods = getClosedMonthPeriods(challengeStartDate);
  const tracking = buildTrackingState(user);
  const results: Array<{ year: number; month: number; penaltyApplied: boolean; penaltyAmountRm: number }> = [];
  const activePeriodFilters = periods.map((period) => ({
    month: period.month,
    year: period.year,
  }));

  for (const period of periods) {
    const penaltyExempt = isPenaltyExemptPeriod(challengeStartDate, period);
    const targetRatioPct = getTargetRatioPctForPeriod(monthPolicies, period);
    const requiredLossKg = getRequiredLossKg(tracking.monthlyLossTargetKg, targetRatioPct);
    const measurementStart = penaltyExempt ? challengeStartDate : period.start;
    const totalLostBeforeMonth = getTotalKgLostBefore(tracking.timeline, measurementStart);
    const totalLostAtMonthEnd = getTotalKgLostOnOrBefore(tracking.timeline, period.end);
    const weightLoss = roundTo(totalLostAtMonthEnd - totalLostBeforeMonth, 2);
    const startWeight = getLatestResolvedWeightBefore(tracking.timeline, measurementStart) ?? user.startWeight;
    const endWeight = getLatestResolvedWeightOnOrBefore(tracking.timeline, period.end) ?? startWeight;
    const reachedGoal = goalReachedByPeriodEnd(tracking.targetLossKg, tracking.timeline, period.end);
    let penaltyApplied = !penaltyExempt && weightLoss < requiredLossKg;

    if (reachedGoal) {
      penaltyApplied = false;
    }

    const penaltyAmountRm = penaltyApplied ? tracking.monthlyPenaltyRm : 0;

    await db.monthlyResult.upsert({
      where: {
        userId_month_year: {
          userId: user.id,
          month: period.month,
          year: period.year,
        },
      },
      create: {
        userId: user.id,
        month: period.month,
        year: period.year,
        startWeight,
        endWeight,
        weightLoss,
        requiredLossKg,
        targetRatioPct,
        penaltyApplied,
        penaltyExempt,
        penaltyAmountRm,
      },
      update: {
        startWeight,
        endWeight,
        weightLoss,
        requiredLossKg,
        targetRatioPct,
        penaltyApplied,
        penaltyExempt,
        penaltyAmountRm,
      },
    });

    results.push({
      month: period.month,
      year: period.year,
      penaltyApplied,
      penaltyAmountRm,
    });
  }

  if (activePeriodFilters.length === 0) {
    await db.monthlyResult.deleteMany({
      where: {
        userId: user.id,
      },
    });
  } else {
    await db.monthlyResult.deleteMany({
      where: {
        userId: user.id,
        NOT: {
          OR: activePeriodFilters,
        },
      },
    });
  }

  const totalRmOwed = results.reduce((total, result) => total + result.penaltyAmountRm, 0);

  await db.user.update({
    where: { id: user.id },
    data: {
      goalReached: tracking.goalReached,
      totalRmOwed,
      targetWeight: tracking.targetWeight,
      targetLossKg: tracking.targetLossKg,
    },
  });
}

export async function syncUserMonthlyResults(userId: string, db: DbClient = prisma) {
  const monthPolicies = buildMonthPolicyMap(
    await db.monthPolicy.findMany({
      select: {
        month: true,
        year: true,
        requiredTargetPct: true,
      },
    }),
  );
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      weightEntries: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      },
      monthlyResults: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
      },
    },
  });

  if (!user) {
    return null;
  }

  if (!isParticipantUser(user)) {
    await db.monthlyResult.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await db.user.update({
      where: { id: user.id },
      data: {
        goalReached: false,
        totalRmOwed: 0,
      },
    });

    return user.id;
  }

  await upsertMonthlyResultsForUser(user, monthPolicies, db);

  return user.id;
}

export async function syncAllMonthlyResults() {
  const monthPolicies = buildMonthPolicyMap(
    await prisma.monthPolicy.findMany({
      select: {
        month: true,
        year: true,
        requiredTargetPct: true,
      },
    }),
  );
  const users = await prisma.user.findMany({
    where: {
      isParticipant: true,
    },
    include: {
      weightEntries: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      },
      monthlyResults: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
      },
    },
  });

  for (const user of users) {
    await upsertMonthlyResultsForUser(user, monthPolicies, prisma);
  }
}

export async function getDashboardPayload(viewerUserId?: string) {
  await syncAllMonthlyResults();
  const monthPolicies = buildMonthPolicyMap(
    await prisma.monthPolicy.findMany({
      select: {
        month: true,
        year: true,
        requiredTargetPct: true,
      },
    }),
  );

  const users = await prisma.user.findMany({
    where: {
      isParticipant: true,
    },
    include: {
      weightEntries: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      },
      monthlyResults: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const summaries = users.map((user) => buildDashboardUser(user, monthPolicies, viewerUserId));
  const currentMonth = getCurrentMonthPeriod();

  return {
    users: summaries,
    groupSummary: buildGroupSummary(summaries),
    lossLeaderboard: buildLeaderboard(summaries, "kgLost"),
    progressLeaderboard: buildLeaderboard(summaries, "progressPct"),
    currentMonthLabel: getMonthLabel(currentMonth.month, currentMonth.year),
  };
}

function buildHistoryRows(displayMode: TrackingDisplayMode, timeline: ResolvedWeightEntry[]): ProfileHistoryRow[] {
  if (displayMode === "weight") {
    return [...timeline]
      .filter((entry) => entry.resolvedWeight !== null)
      .map((entry) => ({
        id: entry.id,
        date: formatDate(entry.date),
        isoDate: entry.date.toISOString(),
        entryType: entry.entryType,
        weight: entry.resolvedWeight,
        changeKg: entry.changeKg,
        totalKgLost: entry.totalKgLost,
      }));
  }

  return [...timeline].reverse().map((entry) => ({
    id: entry.id,
    date: formatDate(entry.date),
    isoDate: entry.date.toISOString(),
    entryType: entry.entryType,
    weight: null,
    changeKg: entry.changeKg,
    totalKgLost: entry.totalKgLost,
  }));
}

export async function getUserProfilePayload(userId: string, viewerUserId: string): Promise<UserProfilePayload | null> {
  await syncUserMonthlyResults(userId);
  const monthPolicies = buildMonthPolicyMap(
    await prisma.monthPolicy.findMany({
      select: {
        month: true,
        year: true,
        requiredTargetPct: true,
      },
    }),
  );

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      weightEntries: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      },
      monthlyResults: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
      },
    },
  });

  if (!user || !isParticipantUser(user)) {
    return null;
  }

  const tracking = buildTrackingState(user, viewerUserId);
  const summary = buildDashboardUser(user, monthPolicies, viewerUserId);
  const bmi = buildBmiSummary(user, tracking);

  const monthlyResults: ProfileMonthlyResult[] = user.monthlyResults.map((result) => {
    const periodEnd = new Date(Date.UTC(result.year, result.month, 0, 23, 59, 59, 999));
    const goalReachedAtMonthEnd = goalReachedByPeriodEnd(tracking.targetLossKg, tracking.timeline, periodEnd);
    const status = getHistoricalMonthlyStatus(result.penaltyExempt, goalReachedAtMonthEnd, result.penaltyApplied);

    return {
      id: result.id,
      month: result.month,
      year: result.year,
      startWeight: tracking.displayMode === "weight" ? result.startWeight : null,
      endWeight: tracking.displayMode === "weight" ? result.endWeight : null,
      weightLoss: result.weightLoss,
      requiredLossKg: result.requiredLossKg,
      targetRatioPct: result.targetRatioPct,
      penaltyApplied: result.penaltyApplied,
      penaltyExempt: result.penaltyExempt,
      penaltyAmountRm: result.penaltyAmountRm,
      status,
      statusDetail: result.penaltyExempt
        ? `Started on ${formatDate(tracking.challengeStartDate)}`
        : result.targetRatioPct !== 100
          ? `${result.targetRatioPct}% month required ${formatWeight(result.requiredLossKg)}`
          : `Required ${formatWeight(result.requiredLossKg)}`,
    };
  });

  return {
    user: summary,
    displayMode: tracking.displayMode,
    canManagePrivacy: user.id === viewerUserId && user.passwordHash !== null,
    canEditStartingWeight: user.id === viewerUserId && user.passwordHash !== null && user.isPrivate,
    bmi,
    chartPoints:
      tracking.displayMode === "weight"
        ? tracking.timeline
            .filter((entry) => entry.resolvedWeight !== null)
            .map((entry) => ({
              date: formatDate(entry.date),
              value: entry.resolvedWeight!,
            }))
        : tracking.timeline.map((entry) => ({
            date: formatDate(entry.date),
            value: entry.totalKgLost,
          })),
    history: buildHistoryRows(tracking.displayMode, tracking.timeline),
    monthlyResults,
  };
}

export async function getAdminPayload() {
  await syncAllMonthlyResults();
  const monthPolicies = await prisma.monthPolicy.findMany({
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  const users = await prisma.user.findMany({
    include: {
      weightEntries: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      },
      monthlyResults: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const adminUsers: AdminUserSummary[] = users.map((user) => {
    if (!isParticipantUser(user)) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isParticipant: false,
        isPrivate: false,
        hasLoginAccess: user.passwordHash !== null,
        goalReached: false,
        heightCm: null,
        startWeight: null,
        targetWeight: null,
        targetLossKg: null,
        monthlyLossTargetKg: MONTHLY_LOSS_TARGET_KG,
        monthlyPenaltyRm: RM_PENALTY,
        challengeStartDateIso: null,
        currentWeight: null,
        totalKgLost: 0,
        progressPct: 0,
        totalRmOwed: user.totalRmOwed,
        claimCode: user.claimCode,
        needsStartingWeight: false,
        adminCanTogglePrivacy: false,
      };
    }

    const tracking = buildTrackingState(user);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      isParticipant: true,
      isPrivate: user.isPrivate,
      hasLoginAccess: user.passwordHash !== null,
      goalReached: tracking.goalReached,
      heightCm: user.heightCm,
      startWeight: user.isPrivate ? null : user.startWeight,
      targetWeight: user.isPrivate ? null : tracking.targetWeight,
      targetLossKg: tracking.targetLossKg,
      monthlyLossTargetKg: tracking.monthlyLossTargetKg,
      monthlyPenaltyRm: tracking.monthlyPenaltyRm,
      challengeStartDateIso: tracking.challengeStartDate.toISOString(),
      currentWeight: user.isPrivate ? null : tracking.currentWeight,
      totalKgLost: tracking.kgLost,
      progressPct: tracking.progressPct,
      totalRmOwed: user.totalRmOwed,
      claimCode: user.claimCode,
      needsStartingWeight: user.isPrivate && user.startWeight === null,
      adminCanTogglePrivacy: user.passwordHash === null,
    };
  });

  const entries: AdminEntrySummary[] = users
    .filter(isParticipantUser)
    .flatMap((user) => {
      const tracking = buildTrackingState(user);
      const timelineById = new Map(tracking.timeline.map((entry) => [entry.id, entry]));

      return user.weightEntries
        .filter((entry) => !user.isPrivate || entry.entryType === "LOSS_DELTA")
        .map((entry) => {
          const resolvedEntry = timelineById.get(entry.id);

          return {
            id: entry.id,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            userIsPrivate: user.isPrivate,
            entryType: entry.entryType,
            weight: entry.weight,
            visibleWeight: user.isPrivate ? null : resolvedEntry?.resolvedWeight ?? entry.weight,
            lossKg: entry.lossKg,
            totalKgLost: resolvedEntry?.totalKgLost ?? 0,
            isoDate: entry.date.toISOString(),
          };
        });
    })
    .sort((left, right) => new Date(right.isoDate).getTime() - new Date(left.isoDate).getTime());

  return {
    users: adminUsers,
    entries,
    monthPolicies,
  };
}
