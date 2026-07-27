"use client";

import { AvatarEditor } from "@/components/avatar-editor";

interface ProfileAvatarControlProps {
  avatarUrl: string | null;
  canEdit: boolean;
  name: string;
  targetUserId: string;
}

export function ProfileAvatarControl({
  avatarUrl,
  canEdit,
  name,
  targetUserId,
}: ProfileAvatarControlProps) {
  return (
    <AvatarEditor
      avatarUrl={avatarUrl}
      canEdit={canEdit}
      name={name}
      presentation="profile"
      targetUserId={targetUserId}
    />
  );
}
