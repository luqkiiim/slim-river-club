"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId } from "react";

import { updateOwnStartingWeightAction } from "@/lib/actions/admin-actions";
import { initialActionState } from "@/types/form";

interface PrivateStartingWeightFormProps {
  currentValue?: number | null;
}

export function PrivateStartingWeightForm({ currentValue }: PrivateStartingWeightFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateOwnStartingWeightAction, initialActionState);
  const hasCurrentValue = currentValue !== null && currentValue !== undefined;
  const headingId = useId();
  const descriptionId = useId();
  const inputId = useId();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state]);

  return (
    <section className="rounded-2xl border border-black/10 bg-white/80 p-4" aria-labelledby={headingId}>
      <div className="mb-3">
        <h3 id={headingId} className="text-sm font-semibold text-ink">
          {hasCurrentValue ? "Update your starting weight" : "Set your starting weight"}
        </h3>
        <p id={descriptionId} className="mt-1 text-sm leading-6 text-ink/70">
          This stays private. It lets the app turn earlier admin-entered loss updates into your private weight history.
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
        <label className="block min-w-0 space-y-2 text-sm font-medium text-ink" htmlFor={inputId}>
          <span>Starting weight (kg)</span>
          <input
            aria-describedby={descriptionId}
            className="field min-h-11 text-base"
            id={inputId}
            inputMode="decimal"
            name="startWeight"
            type="number"
            step="0.01"
            min="1"
            defaultValue={currentValue ?? undefined}
            required
          />
        </label>
        <button className="primary-button min-h-11 w-full px-4 py-2 sm:w-auto" type="submit" disabled={isPending}>
          {isPending ? "Saving starting weight..." : hasCurrentValue ? "Update starting weight" : "Save starting weight"}
        </button>
      </form>
    </section>
  );
}
