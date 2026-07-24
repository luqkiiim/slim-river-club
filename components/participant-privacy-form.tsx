"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId } from "react";

import { updateOwnPrivacyModeAction } from "@/lib/actions/admin-actions";
import { initialActionState } from "@/types/form";

interface ParticipantPrivacyFormProps {
  isPrivate: boolean;
}

export function ParticipantPrivacyForm({ isPrivate }: ParticipantPrivacyFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateOwnPrivacyModeAction, initialActionState);
  const headingId = useId();
  const descriptionId = useId();
  const selectId = useId();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state]);

  return (
    <section className="rounded-2xl border border-black/10 bg-sand/35 p-4" aria-labelledby={headingId}>
      <div className="mb-3">
        <h3 id={headingId} className="text-sm font-semibold text-ink">Profile visibility</h3>
        <p id={descriptionId} className="mt-1 text-sm leading-6 text-ink/70">
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
          role={state.status === "error" ? "alert" : "status"}
          aria-live={state.status === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          {state.message}
        </div>
      ) : null}

      <form action={formAction} aria-busy={isPending} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block min-w-0 space-y-2 text-sm font-medium text-ink" htmlFor={selectId}>
          <span>Who can see your weight?</span>
          <select
            aria-describedby={descriptionId}
            className="field min-h-11 text-base"
            id={selectId}
            name="privacyMode"
            defaultValue={isPrivate ? "private" : "public"}
          >
            <option value="public">Everyone in the group</option>
            <option value="private">Only me</option>
          </select>
        </label>
        <button className="secondary-button min-h-11 w-full px-4 py-2 sm:w-auto" type="submit" disabled={isPending}>
          {isPending ? "Saving visibility..." : "Save visibility"}
        </button>
      </form>
    </section>
  );
}
