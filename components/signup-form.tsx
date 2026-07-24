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
    <section className="w-full rounded-[30px] border border-black/5 bg-cream/95 p-5 shadow-[0_18px_48px_rgba(35,49,35,0.10)] backdrop-blur-sm sm:p-8">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-moss">
          {allowAdminOnly ? "Create the first account" : "Claim your profile"}
        </p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight [font-family:var(--font-heading)] sm:text-4xl">
          {allowAdminOnly ? "Create your club account" : "Connect to your progress"}
        </h1>
        <p className="mt-3 max-w-md text-base leading-6 text-ink/70">
          {allowAdminOnly
            ? "The first account becomes the club admin. Personal weight tracking is optional."
            : "Enter the claim code from your admin, then choose the email and password you will use to log in."}
        </p>
      </div>

      {state.message ? (
        <div
          id="signup-feedback"
          className={`mb-4 rounded-2xl px-4 py-3 text-sm ${
            state.status === "error"
              ? "border border-blush/25 bg-blush/10 text-[#8f4a36]"
              : "border border-leaf/20 bg-leaf/10 text-moss"
          }`}
          role={state.status === "error" ? "alert" : "status"}
          aria-live={state.status === "error" ? "assertive" : "polite"}
        >
          {state.message}
        </div>
      ) : null}

      <form action={formAction} className="space-y-5" aria-busy={isPending}>
        {!allowAdminOnly ? <input type="hidden" name="trackWeight" value="true" /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {allowAdminOnly ? (
            <>
              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Name</span>
                <input className="field min-h-12 text-base" name="name" type="text" autoComplete="name" required />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Email</span>
                <input className="field min-h-12 text-base" name="email" type="email" autoComplete="email" required />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Password</span>
                <input className="field min-h-12 text-base" name="password" type="password" autoComplete="new-password" required />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Confirm password</span>
                <input
                  className="field min-h-12 text-base"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </label>

              <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border border-black/10 bg-sand/55 px-4 py-4 text-sm text-ink sm:col-span-2">
                <input
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#274235]"
                  name="trackWeight"
                  type="checkbox"
                  checked={trackWeight}
                  onChange={(event) => setTrackWeight(event.target.checked)}
                  aria-controls="participant-weight-fields"
                />
                <span>
                  <span className="font-medium">I will track my own weight</span>
                  <span className="mt-1 block leading-5 text-ink/70">
                    Turn this off if this account is only for admin access and group management.
                  </span>
                </span>
              </label>

              {trackWeight ? (
                <div id="participant-weight-fields" className="contents">
                  <label className="block space-y-2 text-sm font-medium text-ink">
                    <span>Starting weight (kg)</span>
                    <input
                      className="field min-h-12 text-base"
                      name="startingWeight"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="1"
                      required={trackWeight}
                    />
                  </label>

                  <label className="block space-y-2 text-sm font-medium text-ink">
                    <span>Target weight (kg)</span>
                    <input
                      className="field min-h-12 text-base"
                      name="targetWeight"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="1"
                      required={trackWeight}
                    />
                  </label>
                </div>
              ) : (
                <div
                  id="participant-weight-fields"
                  className="rounded-2xl border border-dashed border-black/10 bg-white/55 px-4 py-4 text-sm leading-6 text-ink/70 sm:col-span-2"
                >
                  This will be an admin-only account. It will stay out of participant progress and accountability rules.
                </div>
              )}
            </>
          ) : (
            <>
              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Claim code</span>
                <input
                  className="field min-h-12 text-base uppercase tracking-[0.12em]"
                  name="claimCode"
                  type="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Email</span>
                <input className="field min-h-12 text-base" name="email" type="email" autoComplete="email" required />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Password</span>
                <input className="field min-h-12 text-base" name="password" type="password" autoComplete="new-password" required />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink sm:col-span-2">
                <span>Confirm password</span>
                <input
                  className="field min-h-12 text-base"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </label>
            </>
          )}
        </div>

        <button className="primary-button min-h-12 w-full text-base" type="submit" disabled={isPending}>
          {isPending ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/70">
        Already registered?{" "}
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-moss underline-offset-4 outline-none hover:underline focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-leaf"
          href="/login"
        >
          Log in
        </Link>
      </p>
    </section>
  );
}
