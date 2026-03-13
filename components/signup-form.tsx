"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { signUpAction } from "@/lib/actions/auth-actions";
import { initialActionState } from "@/types/form";

interface SignupFormProps {
  allowAdminOnly: boolean;
}

export function SignupForm({ allowAdminOnly }: SignupFormProps) {
  const router = useRouter();
  const [trackWeight, setTrackWeight] = useState(true);
  const [state, formAction, isPending] = useActionState(signUpAction, initialActionState);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.push(state.redirectTo);
    }
  }, [router, state]);

  return (
    <div className="panel mx-auto w-full max-w-lg p-7 sm:p-8">
      <div className="mb-8 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">
          {allowAdminOnly ? "Create the first account" : "Claim your profile"}
        </p>
        <h1 className="text-3xl font-semibold [font-family:var(--font-heading)]">
          {allowAdminOnly ? "Create account" : "Sign up with your code"}
        </h1>
        <p className="text-sm text-ink/70">
          {allowAdminOnly
            ? "The first account created becomes the admin for this office group. You can keep it admin-only if you are just managing the group."
            : "Use the claim code from your admin to connect your login to the profile they already prepared for you."}
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

      <form action={formAction} className="space-y-4">
        {!allowAdminOnly ? <input type="hidden" name="trackWeight" value="true" /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {allowAdminOnly ? (
            <>
              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Name</span>
                <input className="field" name="name" type="text" autoComplete="name" required />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Email</span>
                <input className="field" name="email" type="email" autoComplete="email" required />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Password</span>
                <input className="field" name="password" type="password" autoComplete="new-password" required />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Confirm password</span>
                <input className="field" name="confirmPassword" type="password" autoComplete="new-password" required />
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-black/10 bg-sand/45 px-4 py-4 text-sm text-ink sm:col-span-2">
                <input
                  className="mt-1 h-4 w-4"
                  name="trackWeight"
                  type="checkbox"
                  checked={trackWeight}
                  onChange={(event) => setTrackWeight(event.target.checked)}
                />
                <span>
                  Track my own weight in this app.
                  <span className="mt-1 block text-ink/65">
                    Turn this off if this account is only for admin access and group management.
                  </span>
                </span>
              </label>

              {trackWeight ? (
                <>
                  <label className="block space-y-2 text-sm font-medium text-ink">
                    <span>Starting weight (kg)</span>
                    <input className="field" name="startingWeight" type="number" step="0.01" min="1" required={trackWeight} />
                  </label>

                  <label className="block space-y-2 text-sm font-medium text-ink">
                    <span>Target weight (kg)</span>
                    <input className="field" name="targetWeight" type="number" step="0.01" min="1" required={trackWeight} />
                  </label>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-black/10 px-4 py-5 text-sm text-ink/65 sm:col-span-2">
                  This account will be created with admin access only and will stay out of the member dashboard, charts, penalties, and leaderboards.
                </div>
              )}
            </>
          ) : (
            <>
              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Claim code</span>
                <input className="field" name="claimCode" type="text" autoCapitalize="characters" autoComplete="off" required />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Email</span>
                <input className="field" name="email" type="email" autoComplete="email" required />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Password</span>
                <input className="field" name="password" type="password" autoComplete="new-password" required />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Confirm password</span>
                <input className="field" name="confirmPassword" type="password" autoComplete="new-password" required />
              </label>
            </>
          )}
        </div>

        <button className="primary-button w-full" type="submit" disabled={isPending}>
          {isPending ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink/70">
        Already registered?{" "}
        <Link className="font-semibold text-moss underline-offset-4 hover:underline" href="/login">
          Log in
        </Link>
      </p>
    </div>
  );
}
