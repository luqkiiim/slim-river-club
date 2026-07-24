"use client";

import { Trash } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { deleteUserProfileAction } from "@/lib/actions/admin-actions";

interface DeleteUserFormProps {
  userId: string;
  userName: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function DeleteUserForm({ userId, userName, disabled, disabledReason }: DeleteUserFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (disabled) {
    return <p className="text-xs text-ink/70">{disabledReason ?? "This profile cannot be removed."}</p>;
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();

        if (!window.confirm(`Remove ${userName}'s profile? This also deletes all weight entries and monthly results.`)) {
          return;
        }

        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
          await deleteUserProfileAction(formData);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#8f4a36] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6f3526] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        disabled={isPending}
      >
        <Trash aria-hidden size={18} weight="bold" />
        {isPending ? "Removing…" : "Remove profile"}
      </button>
    </form>
  );
}
