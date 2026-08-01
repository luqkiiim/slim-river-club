export interface MonthlyTargetChange {
  userId: string;
  month: number;
  year: number;
  monthlyLossTargetKg: number;
}

export type UserMonthlyTargetMap = Map<string, MonthlyTargetChange[]>;

export function buildUserMonthlyTargetMap(targets: MonthlyTargetChange[]) {
  const targetsByUser: UserMonthlyTargetMap = new Map();

  for (const target of targets) {
    const userTargets = targetsByUser.get(target.userId) ?? [];
    userTargets.push(target);
    targetsByUser.set(target.userId, userTargets);
  }

  for (const userTargets of targetsByUser.values()) {
    userTargets.sort((left, right) => left.year - right.year || left.month - right.month);
  }

  return targetsByUser;
}

export function getMonthlyLossTargetKgForPeriod(
  userId: string,
  baseMonthlyLossTargetKg: number,
  monthlyTargets: UserMonthlyTargetMap,
  period: { month: number; year: number },
) {
  const periodIndex = period.year * 12 + period.month;
  let effectiveTarget: MonthlyTargetChange | undefined;

  for (const target of monthlyTargets.get(userId) ?? []) {
    if (target.year * 12 + target.month > periodIndex) {
      break;
    }

    effectiveTarget = target;
  }

  return effectiveTarget?.monthlyLossTargetKg ?? baseMonthlyLossTargetKg;
}
