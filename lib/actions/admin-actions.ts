"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

import { syncAllMonthlyResults, syncUserMonthlyResults } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, requireParticipantSession } from "@/lib/session";
import { normalizeLoss, normalizeWeight, parseDateInput, parseMonthInput } from "@/lib/weight-utils";
import type { ActionState } from "@/types/form";

function refreshAdminViews(userId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath(`/users/${userId}`);
}

function refreshAdminRoute() {
  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

function refreshParticipantViews(userId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath(`/users/${userId}`);
}

function createRawClaimCode() {
  const left = randomBytes(2).toString("hex").toUpperCase();
  const right = randomBytes(2).toString("hex").toUpperCase();

  return `${left}-${right}`;
}

async function createClaimCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const claimCode = createRawClaimCode();
    const existing = await prisma.user.findUnique({
      where: { claimCode },
      select: { id: true },
    });

    if (!existing) {
      return claimCode;
    }
  }

  throw new Error("Unable to generate a unique claim code.");
}

function getMaxAllowedDate() {
  const today = new Date();

  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));
}

function isFutureDate(date: Date) {
  return date.getTime() > getMaxAllowedDate().getTime();
}

export async function createParticipantProfileAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminSession();

  const name = `${formData.get("name") ?? ""}`.trim();
  const privacyMode = `${formData.get("privacyMode") ?? "public"}`;
  const startWeight = Number(formData.get("startWeight"));
  const targetWeight = Number(formData.get("targetWeight"));
  const targetLossKg = Number(formData.get("targetLossKg"));
  const monthlyPenaltyRm = Number(formData.get("monthlyPenaltyRm"));
  const challengeStartDateValue = `${formData.get("challengeStartDate") ?? ""}`;
  const heightValue = `${formData.get("heightCm") ?? ""}`.trim();
  const heightCm = heightValue ? Number(heightValue) : null;

  if (!name) {
    return {
      status: "error",
      message: "Enter a participant name.",
    };
  }

  if (
    privacyMode === "public" &&
    (!Number.isFinite(startWeight) || !Number.isFinite(targetWeight) || startWeight <= 0 || targetWeight <= 0)
  ) {
    return {
      status: "error",
      message: "Enter valid start and target weights for a public participant.",
    };
  }

  if (privacyMode === "private" && (!Number.isFinite(targetLossKg) || targetLossKg <= 0)) {
    return {
      status: "error",
      message: "Enter a valid target loss for a private participant.",
    };
  }

  if (!Number.isFinite(monthlyPenaltyRm) || monthlyPenaltyRm < 0) {
    return {
      status: "error",
      message: "Enter a valid monthly penalty amount.",
    };
  }

  if (heightValue && (!Number.isFinite(heightCm) || heightCm === null || heightCm < 50 || heightCm > 250)) {
    return {
      status: "error",
      message: "Enter a valid height in cm, or leave it blank.",
    };
  }

  if (!challengeStartDateValue) {
    return {
      status: "error",
      message: "Choose the participant's challenge start date.",
    };
  }

  const challengeStartDate = parseDateInput(challengeStartDateValue);

  if (isFutureDate(challengeStartDate)) {
    return {
      status: "error",
      message: "Challenge start date cannot be in the future.",
    };
  }

  const existingUser = await prisma.user.findFirst({
    where: { name },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    return {
      status: "error",
      message: "A participant with that name already exists.",
    };
  }

  const claimCode = await createClaimCode();

  await prisma.user.create({
    data: {
      name,
      email: null,
      passwordHash: null,
      claimCode,
      isPrivate: privacyMode === "private",
      heightCm: heightCm !== null ? normalizeWeight(heightCm) : null,
      startWeight: privacyMode === "public" ? normalizeWeight(startWeight) : null,
      targetWeight: privacyMode === "public" ? normalizeWeight(targetWeight) : null,
      targetLossKg:
        privacyMode === "private" ? normalizeLoss(targetLossKg) : normalizeWeight(startWeight - targetWeight),
      monthlyPenaltyRm: Math.round(monthlyPenaltyRm),
      challengeStartDate,
      goalReached: privacyMode === "public" ? startWeight <= targetWeight : false,
      isAdmin: false,
      isParticipant: true,
    },
  });

  refreshAdminRoute();

  return {
    status: "success",
    message:
      privacyMode === "private"
        ? `${name}'s private profile is ready. Share the claim code when they should activate the account.`
        : `${name}'s profile is ready for backfill. Share the claim code when they should activate the account.`,
    claimCode,
  };
}

export async function createWeightEntryAction(formData: FormData) {
  await requireAdminSession();

  const userId = `${formData.get("userId") ?? ""}`;
  const weight = Number(formData.get("weight"));
  const dateValue = `${formData.get("date") ?? ""}`;

  if (!userId || !Number.isFinite(weight) || weight <= 0 || !dateValue) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isParticipant: true,
      isPrivate: true,
    },
  });

  if (!user?.isParticipant || user.isPrivate) {
    return;
  }

  const date = parseDateInput(dateValue);

  if (isFutureDate(date)) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.weightEntry.create({
      data: {
        userId,
        entryType: "ABSOLUTE",
        weight: normalizeWeight(weight),
        lossKg: null,
        date,
      },
    });

    await syncUserMonthlyResults(userId, tx);
  });

  refreshAdminViews(userId);
}

export async function createPrivateProgressEntryAction(formData: FormData) {
  await requireAdminSession();

  const userId = `${formData.get("userId") ?? ""}`;
  const lossKg = Number(formData.get("lossKg"));
  const dateValue = `${formData.get("date") ?? ""}`;

  if (!userId || !Number.isFinite(lossKg) || !dateValue) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isParticipant: true,
      isPrivate: true,
    },
  });

  if (!user?.isParticipant || !user.isPrivate) {
    return;
  }

  const date = parseDateInput(dateValue);

  if (isFutureDate(date)) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.weightEntry.create({
      data: {
        userId,
        entryType: "LOSS_DELTA",
        weight: null,
        lossKg: normalizeLoss(lossKg),
        date,
      },
    });

    await syncUserMonthlyResults(userId, tx);
  });

  refreshAdminViews(userId);
}

export async function updateWeightEntryAction(formData: FormData) {
  await requireAdminSession();

  const entryId = `${formData.get("entryId") ?? ""}`;
  const userId = `${formData.get("userId") ?? ""}`;
  const weight = Number(formData.get("weight"));
  const dateValue = `${formData.get("date") ?? ""}`;

  if (!entryId || !userId || !Number.isFinite(weight) || weight <= 0 || !dateValue) {
    return;
  }

  const date = parseDateInput(dateValue);

  if (isFutureDate(date)) {
    return;
  }

  const entry = await prisma.weightEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      entryType: true,
      userId: true,
    },
  });

  if (!entry || entry.entryType !== "ABSOLUTE" || entry.userId !== userId) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.weightEntry.update({
      where: { id: entryId },
      data: {
        weight: normalizeWeight(weight),
        lossKg: null,
        date,
      },
    });

    await syncUserMonthlyResults(userId, tx);
  });

  refreshAdminViews(userId);
}

export async function updatePrivateProgressEntryAction(formData: FormData) {
  await requireAdminSession();

  const entryId = `${formData.get("entryId") ?? ""}`;
  const userId = `${formData.get("userId") ?? ""}`;
  const lossKg = Number(formData.get("lossKg"));
  const dateValue = `${formData.get("date") ?? ""}`;

  if (!entryId || !userId || !Number.isFinite(lossKg) || !dateValue) {
    return;
  }

  const date = parseDateInput(dateValue);

  if (isFutureDate(date)) {
    return;
  }

  const entry = await prisma.weightEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      entryType: true,
      userId: true,
    },
  });

  if (!entry || entry.entryType !== "LOSS_DELTA" || entry.userId !== userId) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.weightEntry.update({
      where: { id: entryId },
      data: {
        weight: null,
        lossKg: normalizeLoss(lossKg),
        date,
      },
    });

    await syncUserMonthlyResults(userId, tx);
  });

  refreshAdminViews(userId);
}

export async function deleteWeightEntryAction(formData: FormData) {
  await requireAdminSession();

  const entryId = `${formData.get("entryId") ?? ""}`;

  if (!entryId) {
    return;
  }

  const entry = await prisma.weightEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!entry) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.weightEntry.delete({
      where: { id: entry.id },
    });

    await syncUserMonthlyResults(entry.userId, tx);
  });

  refreshAdminViews(entry.userId);
}

export async function updateTargetWeightAction(formData: FormData) {
  await requireAdminSession();

  const userId = `${formData.get("userId") ?? ""}`;
  const targetWeight = Number(formData.get("targetWeight"));

  if (!userId || !Number.isFinite(targetWeight) || targetWeight <= 0) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isParticipant: true,
      isPrivate: true,
      startWeight: true,
    },
  });

  if (!user?.isParticipant || user.isPrivate) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        targetWeight: normalizeWeight(targetWeight),
        targetLossKg:
          user.startWeight !== null ? normalizeWeight(user.startWeight - targetWeight) : null,
      },
    });

    await syncUserMonthlyResults(userId, tx);
  });

  refreshAdminViews(userId);
}

export async function updateTargetLossAction(formData: FormData) {
  await requireAdminSession();

  const userId = `${formData.get("userId") ?? ""}`;
  const targetLossKg = Number(formData.get("targetLossKg"));

  if (!userId || !Number.isFinite(targetLossKg) || targetLossKg <= 0) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isParticipant: true,
      isPrivate: true,
      startWeight: true,
    },
  });

  if (!user?.isParticipant || !user.isPrivate) {
    return;
  }

  const normalizedTargetLoss = normalizeLoss(targetLossKg);
  const derivedTargetWeight =
    user.startWeight !== null ? normalizeWeight(user.startWeight - normalizedTargetLoss) : null;

  if (derivedTargetWeight !== null && derivedTargetWeight <= 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        targetLossKg: normalizedTargetLoss,
        targetWeight: derivedTargetWeight,
      },
    });

    await syncUserMonthlyResults(userId, tx);
  });

  refreshAdminViews(userId);
}

export async function updateMonthlyLossTargetAction(formData: FormData) {
  await requireAdminSession();

  const userId = `${formData.get("userId") ?? ""}`;
  const monthlyLossTargetKg = Number(formData.get("monthlyLossTargetKg"));

  if (!userId || !Number.isFinite(monthlyLossTargetKg) || monthlyLossTargetKg <= 0) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isParticipant: true,
    },
  });

  if (!user?.isParticipant) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        monthlyLossTargetKg: normalizeLoss(monthlyLossTargetKg),
      },
    });

    await syncUserMonthlyResults(userId, tx);
  });

  refreshAdminViews(userId);
}

export async function updateMonthlyPenaltyAction(formData: FormData) {
  await requireAdminSession();

  const userId = `${formData.get("userId") ?? ""}`;
  const monthlyPenaltyRm = Number(formData.get("monthlyPenaltyRm"));

  if (!userId || !Number.isFinite(monthlyPenaltyRm) || monthlyPenaltyRm < 0) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isParticipant: true,
    },
  });

  if (!user?.isParticipant) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        monthlyPenaltyRm: Math.round(monthlyPenaltyRm),
      },
    });

    await syncUserMonthlyResults(userId, tx);
  });

  refreshAdminViews(userId);
}

export async function updateChallengeStartDateAction(formData: FormData) {
  await requireAdminSession();

  const userId = `${formData.get("userId") ?? ""}`;
  const dateValue = `${formData.get("challengeStartDate") ?? ""}`;

  if (!userId || !dateValue) {
    return;
  }

  const challengeStartDate = parseDateInput(dateValue);

  if (isFutureDate(challengeStartDate)) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isParticipant: true,
    },
  });

  if (!user?.isParticipant) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        challengeStartDate,
      },
    });

    await syncUserMonthlyResults(userId, tx);
  });

  refreshAdminViews(userId);
}

export async function upsertMonthPolicyAction(formData: FormData) {
  await requireAdminSession();

  const monthValue = `${formData.get("month") ?? ""}`;
  const requiredTargetPct = Number(formData.get("requiredTargetPct"));

  if (!monthValue || !Number.isFinite(requiredTargetPct) || requiredTargetPct <= 0 || requiredTargetPct > 200) {
    return;
  }

  const { month, year } = parseMonthInput(monthValue);
  const normalizedPct = Math.round(requiredTargetPct);

  if (normalizedPct === 100) {
    await prisma.monthPolicy.deleteMany({
      where: {
        month,
        year,
      },
    });
  } else {
    await prisma.monthPolicy.upsert({
      where: {
        month_year: {
          month,
          year,
        },
      },
      update: {
        requiredTargetPct: normalizedPct,
      },
      create: {
        month,
        year,
        requiredTargetPct: normalizedPct,
      },
    });
  }

  await syncAllMonthlyResults();
  refreshAdminRoute();
}

export async function deleteMonthPolicyAction(formData: FormData) {
  await requireAdminSession();

  const policyId = `${formData.get("policyId") ?? ""}`;

  if (!policyId) {
    return;
  }

  await prisma.monthPolicy.delete({
    where: { id: policyId },
  });

  await syncAllMonthlyResults();
  refreshAdminRoute();
}

export async function updateHeightAction(formData: FormData) {
  await requireAdminSession();

  const userId = `${formData.get("userId") ?? ""}`;
  const heightValue = `${formData.get("heightCm") ?? ""}`.trim();
  const heightCm = heightValue ? Number(heightValue) : null;

  if (!userId) {
    return;
  }

  if (heightValue && (!Number.isFinite(heightCm) || heightCm === null || heightCm < 50 || heightCm > 250)) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isParticipant: true,
    },
  });

  if (!user?.isParticipant) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      heightCm: heightCm !== null ? normalizeWeight(heightCm) : null,
    },
  });

  refreshAdminViews(userId);
}

export async function updateStartWeightAction(formData: FormData) {
  await requireAdminSession();

  const userId = `${formData.get("userId") ?? ""}`;
  const startWeight = Number(formData.get("startWeight"));

  if (!userId || !Number.isFinite(startWeight) || startWeight <= 0) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isParticipant: true,
      isPrivate: true,
      targetWeight: true,
    },
  });

  if (!user?.isParticipant || user.isPrivate) {
    return;
  }

  const normalizedStartWeight = normalizeWeight(startWeight);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        startWeight: normalizedStartWeight,
        targetLossKg:
          user.targetWeight !== null ? normalizeWeight(normalizedStartWeight - user.targetWeight) : null,
      },
    });

    await syncUserMonthlyResults(userId, tx);
  });

  refreshAdminViews(userId);
}

export async function updateAdminPrivacyModeAction(formData: FormData) {
  await requireAdminSession();

  const userId = `${formData.get("userId") ?? ""}`;
  const privacyMode = `${formData.get("privacyMode") ?? ""}`;

  if (!userId || (privacyMode !== "private" && privacyMode !== "public")) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isParticipant: true,
      passwordHash: true,
      isPrivate: true,
      startWeight: true,
      targetWeight: true,
      targetLossKg: true,
    },
  });

  if (!user?.isParticipant || user.passwordHash !== null) {
    return;
  }

  if (privacyMode === "public") {
    const targetWeight =
      user.targetWeight !== null
        ? user.targetWeight
        : user.startWeight !== null && user.targetLossKg !== null
          ? normalizeWeight(user.startWeight - user.targetLossKg)
          : null;

    if (user.startWeight === null || targetWeight === null || targetWeight <= 0) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          isPrivate: false,
          targetWeight,
          targetLossKg:
            user.startWeight !== null ? normalizeWeight(user.startWeight - targetWeight) : user.targetLossKg,
        },
      });

      await syncUserMonthlyResults(userId, tx);
    });

    refreshAdminViews(userId);

    return;
  }

  const targetLossKg =
    user.targetLossKg !== null
      ? user.targetLossKg
      : user.startWeight !== null && user.targetWeight !== null
        ? normalizeWeight(user.startWeight - user.targetWeight)
        : null;

  if (targetLossKg === null) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        isPrivate: true,
        targetLossKg,
      },
    });

    await syncUserMonthlyResults(userId, tx);
  });

  refreshAdminViews(userId);
}

export async function updateOwnPrivacyModeAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireParticipantSession();
  const privacyMode = `${formData.get("privacyMode") ?? ""}`;

  if (privacyMode !== "private" && privacyMode !== "public") {
    return {
      status: "error",
      message: "Choose a valid visibility mode.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      isParticipant: true,
      passwordHash: true,
      isPrivate: true,
      startWeight: true,
      targetWeight: true,
      targetLossKg: true,
    },
  });

  if (!user?.isParticipant || user.passwordHash === null) {
    return {
      status: "error",
      message: "This account cannot change privacy settings.",
    };
  }

  if (privacyMode === "public") {
    const targetWeight =
      user.targetWeight !== null
        ? user.targetWeight
        : user.startWeight !== null && user.targetLossKg !== null
          ? normalizeWeight(user.startWeight - user.targetLossKg)
          : null;

    if (user.startWeight === null || targetWeight === null || targetWeight <= 0) {
      return {
        status: "error",
        message: "Set your starting weight first before switching back to public mode.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          isPrivate: false,
          targetWeight,
          targetLossKg:
            user.startWeight !== null ? normalizeWeight(user.startWeight - targetWeight) : user.targetLossKg,
        },
      });

      await syncUserMonthlyResults(user.id, tx);
    });

    refreshParticipantViews(user.id);

    return {
      status: "success",
      message: "Your profile is public again. Historical raw weights are visible now.",
    };
  }

  const targetLossKg =
    user.targetLossKg !== null
      ? user.targetLossKg
      : user.startWeight !== null && user.targetWeight !== null
        ? normalizeWeight(user.startWeight - user.targetWeight)
        : null;

  if (targetLossKg === null) {
    return {
      status: "error",
      message: "A target is required before private mode can be turned on.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        isPrivate: true,
        targetLossKg,
      },
    });

    await syncUserMonthlyResults(user.id, tx);
  });

  refreshParticipantViews(user.id);

  return {
    status: "success",
    message: "Your profile is now private. Admins and other members will only see derived progress.",
  };
}

export async function updateOwnStartingWeightAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireParticipantSession();
  const startWeight = Number(formData.get("startWeight"));

  if (!Number.isFinite(startWeight) || startWeight <= 0) {
    return {
      status: "error",
      message: "Enter a valid starting weight.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      isParticipant: true,
      isPrivate: true,
      targetLossKg: true,
      targetWeight: true,
    },
  });

  if (!user?.isParticipant || !user.isPrivate) {
    return {
      status: "error",
      message: "Only private participant profiles can use this form.",
    };
  }

  const normalizedStartWeight = normalizeWeight(startWeight);
  const derivedTargetWeight =
    user.targetLossKg !== null ? normalizeWeight(normalizedStartWeight - user.targetLossKg) : user.targetWeight;

  if (derivedTargetWeight !== null && derivedTargetWeight <= 0) {
    return {
      status: "error",
      message: "Your starting weight is too low for the current target loss. Ask the admin to reduce the target loss first.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        startWeight: normalizedStartWeight,
        targetWeight: derivedTargetWeight,
      },
    });

    await syncUserMonthlyResults(user.id, tx);
  });

  refreshParticipantViews(user.id);

  return {
    status: "success",
    message: "Your starting weight has been saved. Past private updates now map to your private weight history.",
  };
}

export async function updateUserRoleAction(formData: FormData) {
  const session = await requireAdminSession();
  const userId = `${formData.get("userId") ?? ""}`;
  const isAdmin = formData.get("isAdmin") === "true";

  if (!userId) {
    return;
  }

  if (session.user.id === userId && !isAdmin) {
    const adminCount = await prisma.user.count({
      where: {
        isAdmin: true,
      },
    });

    if (adminCount <= 1) {
      return;
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      isAdmin,
    },
  });

  refreshAdminViews(userId);
}

export async function deleteUserProfileAction(formData: FormData) {
  const session = await requireAdminSession();
  const userId = `${formData.get("userId") ?? ""}`;

  if (!userId || userId === session.user.id) {
    return;
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isAdmin: true,
    },
  });

  if (!targetUser) {
    return;
  }

  if (targetUser.isAdmin) {
    const adminCount = await prisma.user.count({
      where: {
        isAdmin: true,
      },
    });

    if (adminCount <= 1) {
      return;
    }
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  revalidatePath("/dashboard");
  revalidatePath("/admin");
}
