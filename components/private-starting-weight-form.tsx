"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { updateOwnStartingWeightAction } from "@/lib/actions/admin-actions";
import { initialActionState } from "@/types/form";

interface PrivateStartingWeightFormProps {
  currentValue?: number | null;
}

export function PrivateStartingWeightForm({ currentValue }: PrivateStartingWeightFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateOwnStartingWeightAction, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-ink">
          {currentValue !== null && currentValue !== undefined ? "Update your starting weight" : "Set your starting weight"}
        </p>
        <p className="mt-1 text-sm text-ink/65">
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
        >
          {state.message}
        </div>
      ) : null}

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[12rem] space-y-2 text-sm font-medium text-ink">
          <span>Starting weight (kg)</span>
          <input
            className="field"
            name="startWeight"
            type="number"
            step="0.01"
            min="1"
            defaultValue={currentValue ?? undefined}
            required
          />
        </label>
        <button className="primary-button px-4 py-2" type="submit" disabled={isPending}>
          {isPending ? "Saving..." : currentValue !== null && currentValue !== undefined ? "Update" : "Save"}
        </button>
      </form>
    </div>
  );
}
