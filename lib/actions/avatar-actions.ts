"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import type { ActionState } from "@/types/form";

export async function removeAvatarAction(
  targetUserId: string,
): Promise<ActionState> {
  const session = await requireSession();
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { avatarUrl: true, isParticipant: true },
  });

  if (
    !target?.isParticipant ||
    (!session.user.isAdmin && session.user.id !== targetUserId)
  ) {
    return { status: "error", message: "You cannot edit this participant's photo." };
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { avatarUrl: null },
  });

  if (target.avatarUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    await del(target.avatarUrl).catch(() => undefined);
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath(`/users/${targetUserId}`);

  return { status: "success", message: "Profile photo removed." };
}
