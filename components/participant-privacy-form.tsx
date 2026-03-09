"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { updateOwnPrivacyModeAction } from "@/lib/actions/admin-actions";
import { initialActionState } from "@/types/form";

interface ParticipantPrivacyFormProps {
  isPrivate: boolean;
}

export function ParticipantPrivacyForm({ isPrivate }: ParticipantPrivacyFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateOwnPrivacyModeAction, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <div className="rounded-2xl border border-black/10 bg-sand/35 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-ink">Profile visibility</p>
        <p className="mt-1 text-sm text-ink/65">
          After claim, only you can switch between private and public mode.
        </p>
      </div>

      {state.message ? (
        <div
          className={`mb-3 rounded-2xl px-4 py-3 text-sm ${
            state.status === "error"
              ? "border border-blush/25 bg-blush/10 text-[#8f4a36]"
              : "border border-leaf/20 bg-leaf/10 text-moss"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <select className="field min-w-[12rem]" name="privacyMode" defaultValue={isPrivate ? "private" : "public"}>
          <option value="public">Public profile</option>
          <option value="private">Private profile</option>
        </select>
        <button className="secondary-button px-4 py-2" type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}
