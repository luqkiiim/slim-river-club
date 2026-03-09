import {
  type DashboardUserSummary,
  type MonthlyStatus,
  type WeightEntryKind,
} from "@/types/app";

export const RM_PENALTY = 30;
export const MONTHLY_LOSS_TARGET_KG = 2;

export interface WeightEntryPoint {
  id: string;
  entryType: WeightEntryKind;
  weight: number | null;
  lossKg: number | null;
  date: Date;
  createdAt: Date;
}

export interface ResolvedWeightEntry extends WeightEntryPoint {
  resolvedWeight: number | null;
  changeKg: number | null;
  totalKgLost: number;
}

export interface UtcMonthPeriod {
  month: number;
  year: number;
  start: Date;
  end: Date;
}

export function roundTo(value: number, decimals = 2) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeWeight(value: number) {
  return roundTo(value, 2);
}

export function normalizeLoss(value: number) {
  return roundTo(value, 2);
}

export function formatWeight(value: number) {
  const normalized = normalizeWeight(value);
  const rendered = normalized.toFixed(2).replace(/\.?0+$/, "");

  return `${rendered} kg`;
}

export function formatLossDelta(value: number) {
  const normalized = normalizeLoss(value);

  if (normalized === 0) {
    return "No change";
  }

  if (normalized > 0) {
    return `${formatWeight(normalized)} lost`;
  }

  return `${formatWeight(Math.abs(normalized))} gained`;
}

export function formatPercentage(value: number) {
  return `${roundTo(value, 0).toFixed(0)}%`;
}

export function formatRm(amount: number) {
  return `RM${amount}`;
}

export function formatBmi(value: number) {
  return roundTo(value, 1).toFixed(1);
}

export function formatDate(date: Date) {
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
}

export function formatDateInput(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatMonthInput(year: number, month: number) {
  return `${year}-${`${month}`.padStart(2, "0")}`;
}

export function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error("Invalid date");
  }

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function parseMonthInput(value: string) {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) {
    throw new Error("Invalid month");
  }

  return { year, month };
}

export function currentDateInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function currentMonthInputValue() {
  const today = new Date();

  return formatMonthInput(today.getFullYear(), today.getMonth() + 1);
}

export function getCurrentUtcDateAtNoon(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
}

export function calculateKgLost(startWeight: number, currentWeight: number) {
  return roundTo(startWeight - currentWeight, 2);
}

export function calculateProgress(startWeight: number, currentWeight: number, targetWeight: number) {
  const denominator = startWeight - targetWeight;

  if (denominator <= 0) {
    return currentWeight <= targetWeight ? 100 : 0;
  }

  const rawProgress = ((startWeight - currentWeight) / denominator) * 100;

  return roundTo(clamp(rawProgress, 0, 100), 0);
}

export function calculateLossProgress(totalKgLost: number, targetLossKg: number) {
  if (targetLossKg <= 0) {
    return totalKgLost >= 0 ? 100 : 0;
  }

  return roundTo(clamp((totalKgLost / targetLossKg) * 100, 0, 100), 0);
}

export function getRequiredLossKg(monthlyLossTargetKg: number, targetRatioPct = 100) {
  return normalizeLoss((monthlyLossTargetKg * targetRatioPct) / 100);
}

export function calculateBmi(weightKg: number, heightCm: number) {
  if (weightKg <= 0 || heightCm <= 0) {
    return null;
  }

  const heightM = heightCm / 100;

  return roundTo(weightKg / (heightM * heightM), 1);
}

export function getBmiCategory(bmi: number | null) {
  if (bmi === null) {
    return null;
  }

  if (bmi < 18.5) {
    return "Underweight";
  }

  if (bmi < 25) {
    return "Healthy";
  }

  if (bmi < 30) {
    return "Overweight";
  }

  return "Obesity";
}

export function getMonthLabel(month: number, year: number) {
  return new Intl.DateTimeFormat("en-MY", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function getCurrentMonthPeriod(now = new Date()): UtcMonthPeriod {
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();

  return {
    month: monthIndex + 1,
    year,
    start: new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)),
  };
}

export function getClosedMonthPeriods(fromDate: Date, now = new Date()) {
  const periods: UtcMonthPeriod[] = [];
  const cursor = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1, 0, 0, 0));
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));

  while (cursor < currentMonthStart) {
    periods.push({
      month: cursor.getUTCMonth() + 1,
      year: cursor.getUTCFullYear(),
      start: new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1, 0, 0, 0)),
      end: new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 23, 59, 59, 999)),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return periods;
}

export function getEntriesInPeriod<T extends { date: Date }>(entries: T[], period: UtcMonthPeriod) {
  return entries.filter(
    (entry) => entry.date.getTime() >= period.start.getTime() && entry.date.getTime() <= period.end.getTime(),
  );
}

function sortEntries(entries: WeightEntryPoint[]) {
  return [...entries].sort((left, right) => {
    const dateDelta = left.date.getTime() - right.date.getTime();

    if (dateDelta !== 0) {
      return dateDelta;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

export function buildResolvedWeightTimeline(startWeight: number | null, entries: WeightEntryPoint[]) {
  let currentWeight = startWeight;
  let totalKgLost = 0;

  return sortEntries(entries).map<ResolvedWeightEntry>((entry) => {
    const previousWeight = currentWeight;

    if (entry.entryType === "ABSOLUTE") {
      if (entry.weight !== null) {
        currentWeight = normalizeWeight(entry.weight);
      }

      if (startWeight !== null && currentWeight !== null) {
        totalKgLost = calculateKgLost(startWeight, currentWeight);
      }

      return {
        ...entry,
        resolvedWeight: currentWeight,
        changeKg:
          previousWeight !== null && currentWeight !== null ? roundTo(previousWeight - currentWeight, 2) : null,
        totalKgLost,
      };
    }

    const changeKg = entry.lossKg !== null ? normalizeLoss(entry.lossKg) : null;

    if (changeKg !== null) {
      totalKgLost = roundTo(totalKgLost + changeKg, 2);

      if (currentWeight !== null) {
        currentWeight = normalizeWeight(currentWeight - changeKg);
      }
    }

    return {
      ...entry,
      resolvedWeight: currentWeight,
      changeKg,
      totalKgLost,
    };
  });
}

export function getCurrentWeight(startWeight: number | null, entries: ResolvedWeightEntry[]) {
  return entries.at(-1)?.resolvedWeight ?? startWeight;
}

export function getLatestTotalKgLost(entries: ResolvedWeightEntry[]) {
  return entries.at(-1)?.totalKgLost ?? 0;
}

export function getTotalKgLostBefore(entries: ResolvedWeightEntry[], before: Date) {
  return [...entries].reverse().find((entry) => entry.date.getTime() < before.getTime())?.totalKgLost ?? 0;
}

export function getTotalKgLostOnOrBefore(entries: ResolvedWeightEntry[], at: Date) {
  return [...entries].reverse().find((entry) => entry.date.getTime() <= at.getTime())?.totalKgLost ?? 0;
}

export function getLatestResolvedWeightBefore(entries: ResolvedWeightEntry[], before: Date) {
  return [...entries].reverse().find((entry) => entry.date.getTime() < before.getTime() && entry.resolvedWeight !== null)
    ?.resolvedWeight;
}

export function getLatestResolvedWeightOnOrBefore(entries: ResolvedWeightEntry[], at: Date) {
  return [...entries].reverse().find((entry) => entry.date.getTime() <= at.getTime() && entry.resolvedWeight !== null)
    ?.resolvedWeight;
}

export function getCurrentMonthLoss(entries: ResolvedWeightEntry[], period: UtcMonthPeriod) {
  const totalLostBeforeMonth = getTotalKgLostBefore(entries, period.start);
  const totalLostAtPeriodEnd = getTotalKgLostOnOrBefore(entries, period.end);

  return roundTo(totalLostAtPeriodEnd - totalLostBeforeMonth, 2);
}

export function getMonthlyStatus(
  goalReached: boolean,
  currentMonthLoss: number,
  monthlyLossTargetKg = MONTHLY_LOSS_TARGET_KG,
): MonthlyStatus {
  if (goalReached) {
    return "GOAL REACHED";
  }

  if (currentMonthLoss >= monthlyLossTargetKg) {
    return "PASSED";
  }

  return "NEEDS MORE LOSS";
}

export function didReachTargetWeightByDate(entries: ResolvedWeightEntry[], targetWeight: number, periodEnd: Date) {
  return entries.some(
    (entry) => entry.date.getTime() <= periodEnd.getTime() && entry.resolvedWeight !== null && entry.resolvedWeight <= targetWeight,
  );
}

export function didReachTargetLossByDate(entries: ResolvedWeightEntry[], targetLossKg: number, periodEnd: Date) {
  if (targetLossKg <= 0) {
    return true;
  }

  return entries.some((entry) => entry.date.getTime() <= periodEnd.getTime() && entry.totalKgLost >= targetLossKg);
}

export function isLatestWeightPersonalBest(entries: ResolvedWeightEntry[]) {
  if (entries.length === 0) {
    return false;
  }

  const latestEntry = entries.at(-1)!;

  if (latestEntry.resolvedWeight !== null) {
    return entries.every(
      (entry) => entry.resolvedWeight === null || latestEntry.resolvedWeight! <= entry.resolvedWeight,
    );
  }

  return entries.every((entry) => latestEntry.totalKgLost >= entry.totalKgLost);
}

export function sortByLeaderboardMetric(
  a: DashboardUserSummary,
  b: DashboardUserSummary,
  metric: "kgLost" | "progressPct",
) {
  const delta = b[metric] - a[metric];

  if (delta !== 0) {
    return delta;
  }

  return a.name.localeCompare(b.name);
}
