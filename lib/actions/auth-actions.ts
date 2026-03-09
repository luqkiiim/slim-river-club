"use server";

import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { normalizeWeight } from "@/lib/weight-utils";
import type { ActionState } from "@/types/form";

export async function signUpAction(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const name = `${formData.get("name") ?? ""}`.trim();
  const claimCode = `${formData.get("claimCode") ?? ""}`.trim().toUpperCase();
  const email = `${formData.get("email") ?? ""}`.trim().toLowerCase();
  const password = `${formData.get("password") ?? ""}`;
  const shouldTrackWeight = formData.get("trackWeight") !== null;
  const startingWeight = Number(formData.get("startingWeight"));
  const targetWeight = Number(formData.get("targetWeight"));
  const userCount = await prisma.user.count();
  const isFirstUser = userCount === 0;

  if (!password || (isFirstUser && (!name || !email)) || (!isFirstUser && !email)) {
    return {
      status: "error",
      message: "Please complete all fields.",
    };
  }

  if (password.length < 8) {
    return {
      status: "error",
      message: "Password must be at least 8 characters.",
    };
  }

  if (isFirstUser && !shouldTrackWeight) {
    if (!name || !email) {
      return {
        status: "error",
        message: "Please complete all fields.",
      };
    }
  }

  if (!isFirstUser && (!claimCode || !email)) {
    return {
      status: "error",
      message: "Enter your claim code, email, and password.",
    };
  }

  if (isFirstUser && shouldTrackWeight && (!Number.isFinite(startingWeight) || !Number.isFinite(targetWeight) || startingWeight <= 0 || targetWeight <= 0)) {
    return {
      status: "error",
      message: "Weights must be valid numbers.",
    };
  }

  const existingUserWithEmail = await prisma.user.findUnique({
    where: { email },
  });

  if (isFirstUser && existingUserWithEmail) {
    return {
      status: "error",
      message: "An account with that email already exists.",
    };
  }

  const passwordHash = await hash(password, 12);

  if (isFirstUser) {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        isPrivate: false,
        startWeight: shouldTrackWeight ? normalizeWeight(startingWeight) : null,
        targetWeight: shouldTrackWeight ? normalizeWeight(targetWeight) : null,
        targetLossKg: shouldTrackWeight ? normalizeWeight(startingWeight - targetWeight) : null,
        goalReached: shouldTrackWeight ? startingWeight <= targetWeight : false,
        isAdmin: true,
        isParticipant: shouldTrackWeight,
      },
    });

    return {
      status: "success",
      message: shouldTrackWeight
        ? "Account created. You are the initial admin."
        : "Admin account created. You can manage the group after logging in.",
      redirectTo: `/login?registered=1&email=${encodeURIComponent(email)}`,
    };
  }

  const claimTarget = await prisma.user.findUnique({
    where: { claimCode },
    select: {
      id: true,
      isParticipant: true,
      passwordHash: true,
    },
  });

  if (!claimTarget || !claimTarget.isParticipant || claimTarget.passwordHash !== null) {
    return {
      status: "error",
      message: "That claim code is invalid or has already been used.",
    };
  }

  if (existingUserWithEmail && existingUserWithEmail.id !== claimTarget.id) {
    return {
      status: "error",
      message: "An account with that email already exists.",
    };
  }

  await prisma.user.update({
    where: { id: claimTarget.id },
    data: {
      email,
      passwordHash,
      claimCode: null,
    },
  });

  return {
    status: "success",
    message: "Profile claimed. You can log in now.",
    redirectTo: `/login?registered=1&email=${encodeURIComponent(email)}`,
  };
}
