"use client";

import { Scales, X } from "@phosphor-icons/react";
import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { logWeightAction } from "@/lib/actions/weight-actions";
import { currentDateInputValue } from "@/lib/weight-utils";
import { initialActionState } from "@/types/form";

interface LogWeightModalProps {
  currentUserName: string;
  disabled?: boolean;
  triggerVariant?: "desktop" | "nav";
}

export function LogWeightModal({
  currentUserName,
  disabled = false,
  triggerVariant = "desktop",
}: LogWeightModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [dateValue, setDateValue] = useState(currentDateInputValue());
  const [showFeedback, setShowFeedback] = useState(false);
  const [state, formAction, isPending] = useActionState(logWeightAction, initialActionState);
  const maxDateValue = currentDateInputValue();

  useEffect(() => {
    if (open) {
      setDateValue(maxDateValue);
      setShowFeedback(false);
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      window.requestAnimationFrame(() => weightInputRef.current?.focus());

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setOpen(false);
          return;
        }

        if (event.key !== "Tab" || !dialogRef.current) {
          return;
        }

        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
          ),
        );
        const first = focusable[0];
        const last = focusable.at(-1);

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      };

      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = previousOverflow;
        triggerRef.current?.focus();
      };
    }

    return undefined;
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
  }, [state]);

  return (
    <>
      {triggerVariant === "nav" ? (
        <div className="relative flex min-h-14 flex-col items-center justify-end">
          <button
            ref={triggerRef}
            aria-haspopup="dialog"
            aria-label={disabled ? "Log weight unavailable until starting weight is set" : "Log weight"}
            className="absolute -top-8 grid h-16 w-16 place-items-center rounded-full border-[5px] border-cream bg-moss text-white shadow-float transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-moss/45"
            disabled={disabled}
            onClick={() => setOpen(true)}
            title={disabled ? "Set your starting weight before logging" : undefined}
            type="button"
          >
            <Scales aria-hidden size={27} weight="bold" />
          </button>
          <span className={`text-xs font-semibold ${disabled ? "text-ink/45" : "text-moss"}`}>Log</span>
        </div>
      ) : (
        <div className="mx-auto hidden w-full max-w-7xl px-5 pb-8 sm:px-6 lg:block">
          <button
            ref={triggerRef}
            aria-haspopup="dialog"
            type="button"
            className="primary-button mx-auto flex w-full max-w-xl shadow-float"
            onClick={() => setOpen(true)}
          >
            <Scales aria-hidden size={22} weight="bold" />
            Log weight
          </button>
        </div>
      )}

      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-5">
          <button
            aria-label="Dismiss weight entry dialog"
            className="absolute inset-0 cursor-default"
            onClick={() => setOpen(false)}
            type="button"
          />
          <div
            ref={dialogRef}
            aria-describedby="log-weight-description"
            aria-labelledby="log-weight-title"
            aria-modal="true"
            className="panel relative max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto overscroll-contain p-5 sm:max-h-[calc(100dvh-2.5rem)] sm:p-6"
            role="dialog"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Official weigh-in: Saturday</p>
                <h2 className="mt-2 text-2xl font-semibold [font-family:var(--font-heading)]" id="log-weight-title">
                  Log weight
                </h2>
                <p className="mt-1 text-sm leading-6 text-ink/70" id="log-weight-description">
                  {currentUserName}, add your latest recorded weight or backfill a past weigh-in.
                </p>
              </div>
              <button
                aria-label="Close weight entry dialog"
                type="button"
                className="icon-button"
                onClick={() => setOpen(false)}
              >
                <X aria-hidden size={21} weight="bold" />
              </button>
            </div>

            {showFeedback && state.message ? (
              <div
                aria-live={state.status === "error" ? "assertive" : "polite"}
                className={`mb-4 rounded-2xl px-4 py-3 text-sm ${
                  state.status === "error"
                    ? "border border-blush/25 bg-blush/10 text-[#8f4a36]"
                    : "border border-leaf/20 bg-leaf/10 text-moss"
                }`}
                role={state.status === "error" ? "alert" : "status"}
              >
                {state.message}
              </div>
            ) : null}

            <form ref={formRef} action={formAction} aria-busy={isPending} className="space-y-4">
              <label className="block space-y-2 text-sm font-medium text-ink">
                <span>Weight (kg)</span>
                <input
                  ref={weightInputRef}
                  className="field"
                  inputMode="decimal"
                  name="weight"
                  type="number"
                  step="0.01"
                  min="1"
                  required
                />
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
                {isPending ? "Saving weight…" : "Save weight"}
              </button>
            </form>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
