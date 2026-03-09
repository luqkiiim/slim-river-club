"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { logWeightAction } from "@/lib/actions/weight-actions";
import { currentDateInputValue } from "@/lib/weight-utils";
import { initialActionState } from "@/types/form";

interface LogWeightModalProps {
  currentUserName: string;
}

export function LogWeightModal({ currentUserName }: LogWeightModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [dateValue, setDateValue] = useState(currentDateInputValue());
  const [showFeedback, setShowFeedback] = useState(false);
  const [state, formAction, isPending] = useActionState(logWeightAction, initialActionState);
  const maxDateValue = currentDateInputValue();

  useEffect(() => {
    if (open) {
      setDateValue(maxDateValue);
      setShowFeedback(false);
    }
  }, [maxDateValue, open]);

  useEffect(() => {
    if (state.status !== "idle") {
      setShowFeedback(true);
    }

    if (state.status === "success") {
      formRef.current?.reset();
      const timeout = window.setTimeout(() => {
        setOpen(false);
      }, 900);

      return () => window.clearTimeout(timeout);
    }

    return undefined;
  }, [state.status]);

  return (
    <>
      <button
        type="button"
        className="fixed bottom-6 right-6 z-20 rounded-full bg-moss px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(39,66,53,0.28)] transition hover:bg-ink"
        onClick={() => setOpen(true)}
      >
        Log Weight
      </button>

      {open ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/35 p-4 sm:items-center">
          <div className="panel w-full max-w-md p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-moss">Official weigh-in day is Saturday</p>
                <h2 className="mt-2 text-2xl font-semibold [font-family:var(--font-heading)]">Log weight</h2>
                <p className="mt-1 text-sm text-ink/65">
                  {currentUserName}, add your latest recorded weight or backfill a past weigh-in.
                </p>
              </div>
              <button type="button" className="secondary-button px-4 py-2" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            {showFeedback && state.message ? (
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

            <form ref={formRef} action={formAction} className="space-y-4">
              <label className="block space-y-2 text-sm font-medium text-ink">
                <span>Weight (kg)</span>
                <input className="field" name="weight" type="number" step="0.01" min="1" required />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink">
                <span>Date</span>
                <input
                  className="field"
                  name="date"
                  type="date"
                  max={maxDateValue}
                  value={dateValue}
                  onChange={(event) => setDateValue(event.target.value)}
                  required
                />
              </label>

              <button className="primary-button w-full" type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Submit"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
