"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { CopyValueField } from "@/components/copy-value-field";
import { createParticipantProfileAction } from "@/lib/actions/admin-actions";
import { RM_PENALTY, currentDateInputValue } from "@/lib/weight-utils";
import { initialActionState } from "@/types/form";

export function CreateParticipantForm() {
  const router = useRouter();
  const [latestClaimCode, setLatestClaimCode] = useState<string | null>(null);
  const [privacyMode, setPrivacyMode] = useState<"public" | "private">("public");
  const [state, formAction, isPending] = useActionState(createParticipantProfileAction, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      setLatestClaimCode(state.claimCode ?? null);
      router.refresh();
    }
  }, [router, state.claimCode, state.status]);

  return (
    <section className="panel mb-6 p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">Create participant</h2>
        <p className="text-sm text-ink/65">
          Create a profile, backfill the right kind of history now, and share the claim code later.
        </p>
      </div>

      {state.message ? (
        <div
          className={`mb-4 rounded-2xl px-4 py-3 text-sm ${
            state.status === "error"
              ? "border border-blush/25 bg-blush/10 text-[#8f4a36]"
              : "border border-leaf/20 bg-leaf/10 text-moss"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <form action={formAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Name</span>
          <input className="field" name="name" type="text" autoComplete="off" required />
        </label>

        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Privacy mode</span>
          <select
            className="field"
            name="privacyMode"
            value={privacyMode}
            onChange={(event) => setPrivacyMode(event.target.value as "public" | "private")}
          >
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </label>

        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Penalty / month</span>
          <input className="field" name="monthlyPenaltyRm" type="number" step="1" min="0" defaultValue={RM_PENALTY} required />
        </label>

        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Challenge start</span>
          <input className="field" name="challengeStartDate" type="date" defaultValue={currentDateInputValue()} required />
        </label>

        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Height (cm)</span>
          <input className="field" name="heightCm" type="number" step="0.01" min="50" max="250" />
        </label>

        {privacyMode === "public" ? (
          <>
            <label className="block space-y-2 text-sm font-medium text-ink">
              <span>Start weight</span>
              <input className="field" name="startWeight" type="number" step="0.01" min="1" required />
            </label>

            <label className="block space-y-2 text-sm font-medium text-ink">
              <span>Target weight</span>
              <input className="field" name="targetWeight" type="number" step="0.01" min="1" required />
            </label>
          </>
        ) : (
          <label className="block space-y-2 text-sm font-medium text-ink lg:col-span-2">
            <span>Target loss</span>
            <input className="field" name="targetLossKg" type="number" step="0.01" min="0.01" required />
          </label>
        )}

        <div className="flex items-end md:col-span-2 xl:col-span-1">
          <button className="primary-button w-full lg:w-auto" type="submit" disabled={isPending}>
            {isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </form>

      <div className="mt-4 rounded-2xl border border-black/10 bg-sand/40 px-4 py-4 text-sm text-ink/65">
        {privacyMode === "public"
          ? "Public participants start with actual weights. Add height if you want the profile to show a BMI meter later."
          : "Private participants start with target loss only. Admins backfill change logs, and the participant adds the private starting weight after claim."}
      </div>

      {latestClaimCode ? (
        <div className="mt-4 rounded-2xl border border-black/10 bg-sand/40 px-4 py-4">
          <p className="text-sm font-semibold text-ink">Latest claim code</p>
          <p className="mt-1 text-sm text-ink/65">Send this code to the participant so they can sign up and claim the profile.</p>
          <CopyValueField value={latestClaimCode} buttonLabel="Copy code" />
        </div>
      ) : null}
    </section>
  );
}
