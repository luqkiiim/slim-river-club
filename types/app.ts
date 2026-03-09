export type MonthlyStatus = "PASSED" | "NEEDS MORE LOSS" | "GOAL REACHED" | "EXEMPT";
export type TrackingDisplayMode = "weight" | "loss";
export type WeightEntryKind = "ABSOLUTE" | "LOSS_DELTA";

export interface BmiSummary {
  heightCm: number | null;
  startBmi: number | null;
  currentBmi: number | null;
  targetBmi: number | null;
  category: string | null;
}

export interface MonthPolicySummary {
  id: string;
  month: number;
  year: number;
  requiredTargetPct: number;
}

export interface DashboardUserSummary {
  id: string;
  name: string;
  email: string | null;
  isPrivate: boolean;
  displayMode: TrackingDisplayMode;
  heightCm: number | null;
  startWeight: number | null;
  currentWeight: number | null;
  targetWeight: number | null;
  targetLossKg: number | null;
  monthlyLossTargetKg: number;
  currentMonthRequiredLossKg: number;
  currentMonthTargetPct: number;
  monthlyPenaltyRm: number;
  challengeStartDateIso: string | null;
  kgLost: number;
  progressPct: number;
  totalRmOwed: number;
  goalReached: boolean;
  monthlyStatus: MonthlyStatus;
  currentMonthLoss: number;
  currentMonthEntryCount: number;
  personalBest: boolean;
  needsStartingWeight: boolean;
  lastLoggedAt?: string;
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  metric: number;
  valueLabel: string;
}

export interface GroupSummary {
  totalMembers: number;
  goalReachedCount: number;
  totalKgLost: number;
  totalRmOwed: number;
}

export interface ProfileHistoryRow {
  id: string;
  date: string;
  isoDate: string;
  entryType: WeightEntryKind;
  weight: number | null;
  changeKg: number | null;
  totalKgLost: number;
}

export interface ProfileMonthlyResult {
  id: string;
  month: number;
  year: number;
  startWeight: number | null;
  endWeight: number | null;
  weightLoss: number;
  requiredLossKg: number;
  targetRatioPct: number;
  penaltyApplied: boolean;
  penaltyExempt: boolean;
  penaltyAmountRm: number;
  status: MonthlyStatus;
  statusDetail?: string;
}

export interface UserProfilePayload {
  user: DashboardUserSummary;
  displayMode: TrackingDisplayMode;
  canManagePrivacy: boolean;
  canEditStartingWeight: boolean;
  bmi: BmiSummary | null;
  chartPoints: Array<{ date: string; value: number }>;
  history: ProfileHistoryRow[];
  monthlyResults: ProfileMonthlyResult[];
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string | null;
  isAdmin: boolean;
  isParticipant: boolean;
  isPrivate: boolean;
  hasLoginAccess: boolean;
  goalReached: boolean;
  heightCm: number | null;
  startWeight: number | null;
  targetWeight: number | null;
  targetLossKg: number | null;
  monthlyLossTargetKg: number;
  monthlyPenaltyRm: number;
  challengeStartDateIso: string | null;
  currentWeight: number | null;
  totalKgLost: number;
  progressPct: number;
  totalRmOwed: number;
  claimCode: string | null;
  needsStartingWeight: boolean;
  adminCanTogglePrivacy: boolean;
}

export interface AdminEntrySummary {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  userIsPrivate: boolean;
  entryType: WeightEntryKind;
  weight: number | null;
  visibleWeight: number | null;
  lossKg: number | null;
  totalKgLost: number;
  isoDate: string;
}
