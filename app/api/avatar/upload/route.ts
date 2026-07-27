import { del } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FINAL_AVATAR_LIMIT = 1024 * 1024;

interface AvatarTokenPayload {
  targetUserId: string;
  previousAvatarUrl: string | null;
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Profile photo uploads are temporarily unavailable." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getServerAuthSession();

        if (!session?.user) {
          throw new Error("Authentication required.");
        }

        let targetUserId = "";

        try {
          targetUserId = JSON.parse(clientPayload ?? "{}").targetUserId ?? "";
        } catch {
          throw new Error("Invalid upload request.");
        }

        const target = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { avatarUrl: true, isParticipant: true },
        });

        if (
          !target?.isParticipant ||
          (!session.user.isAdmin && session.user.id !== targetUserId) ||
          !pathname.startsWith(`avatars/${targetUserId}/`)
        ) {
          throw new Error("You cannot edit this participant's photo.");
        }

        const tokenPayload: AvatarTokenPayload = {
          targetUserId,
          previousAvatarUrl: target.avatarUrl,
        };

        return {
          allowedContentTypes: ["image/webp"],
          maximumSizeInBytes: FINAL_AVATAR_LIMIT,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify(tokenPayload),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = JSON.parse(tokenPayload ?? "{}") as Partial<AvatarTokenPayload>;

        if (!payload.targetUserId || blob.contentType !== "image/webp") {
          await del(blob.url).catch(() => undefined);
          throw new Error("Invalid completed avatar upload.");
        }

        try {
          const target = await prisma.user.findUnique({
            where: { id: payload.targetUserId },
            select: { avatarUrl: true, isParticipant: true },
          });

          if (!target?.isParticipant) {
            throw new Error("Participant no longer exists.");
          }

          await prisma.user.update({
            where: { id: payload.targetUserId },
            data: { avatarUrl: blob.url },
          });

          if (target.avatarUrl && target.avatarUrl !== blob.url) {
            await del(target.avatarUrl).catch(() => undefined);
          }
        } catch (error) {
          await del(blob.url).catch(() => undefined);
          throw error;
        }
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Photo upload failed." },
      { status: 400 },
    );
  }
}
