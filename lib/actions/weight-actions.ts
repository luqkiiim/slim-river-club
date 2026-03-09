"use server";

import { revalidatePath } from "next/cache";

import { syncUserMonthlyResults } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { requireParticipantSession } from "@/lib/session";
import { buildResolvedWeightTimeline, normalizeWeight, parseDateInput } from "@/lib/weight-utils";
import type { ActionState } from "@/types/form";

export async function logWeightAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireParticipantSession();
  const weight = Number(formData.get("weight"));
  const dateValue = `${formData.get("date") ?? ""}`;

  if (!Number.isFinite(weight) || weight <= 0) {
    return {
      status: "error",
      message: "Enter a valid weight.",
    };
  }

  if (!dateValue) {
    return {
      status: "error",
      message: "Missing weigh-in date.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      weightEntries: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!user?.isParticipant) {
    return {
      status: "error",
      message: "This account cannot log weights.",
    };
  }

  if (user.isPrivate && user.startWeight === null) {
    return {
      status: "error",
      message: "Set your starting weight first so your private history can be reconstructed.",
    };
  }

  const date = parseDateInput(dateValue);
  const today = new Date();
  const maxAllowedDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999));

  if (date.getTime() > maxAllowedDate.getTime()) {
    return {
      status: "error",
      message: "Weigh-in dates cannot be in the future.",
    };
  }

  const previousTimeline = buildResolvedWeightTimeline(user.startWeight, user.weightEntries);
  const previousLowestWeight = previousTimeline.reduce<number | null>((lowest, entry) => {
    if (entry.resolvedWeight === null) {
      return lowest;
    }

    if (lowest === null || entry.resolvedWeight < lowest) {
      return entry.resolvedWeight;
    }

    return lowest;
  }, null);

  await prisma.$transaction(async (tx) => {
    await tx.weightEntry.create({
      data: {
        userId: session.user.id,
        entryType: "ABSOLUTE",
        weight: normalizeWeight(weight),
        lossKg: null,
        date,
      },
    });

    await syncUserMonthlyResults(session.user.id, tx);
  });

  revalidatePath("/dashboard");
  revalidatePath(`/users/${session.user.id}`);
  revalidatePath("/admin");

  const personalBest = previousLowestWeight === null ? true : weight < previousLowestWeight;

  return {
    status: "success",
    message: personalBest ? "Weight logged. New Personal Best." : "Weight logged successfully.",
    personalBest,
  };
}
