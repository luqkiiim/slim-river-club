"use client";

import { X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";

interface AdminSheetProps {
  children: ReactNode;
  closeLabel?: string;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function AdminSheet({ children, closeLabel = "Close dialog", description, onClose, open, title }: AdminSheetProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.getClientRects().length > 0);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-ink/35 backdrop-blur-sm"
        onClick={() => onCloseRef.current()}
      />

      <div className="absolute inset-0 flex items-end justify-end sm:inset-x-4 sm:bottom-4 sm:top-8 lg:right-6">
        <section
          aria-describedby={description ? descriptionId : undefined}
          aria-labelledby={titleId}
          aria-modal="true"
          className="flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden border-black/10 bg-cream shadow-[0_24px_90px_rgba(31,42,31,0.22)] outline-none sm:h-full sm:max-w-3xl sm:rounded-[32px] sm:border"
          ref={dialogRef}
          role="dialog"
          tabIndex={-1}
        >
          <header className="shrink-0 border-b border-black/5 bg-cream/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur sm:px-6 sm:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">Admin workspace</p>
                <h2
                  className="mt-1 truncate text-xl font-semibold [font-family:var(--font-heading)] text-ink sm:text-2xl"
                  id={titleId}
                >
                  {title}
                </h2>
                {description ? (
                  <p className="mt-1 max-w-2xl text-sm leading-5 text-ink/70" id={descriptionId}>
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                aria-label={closeLabel}
                className="secondary-button flex h-11 w-11 shrink-0 items-center justify-center px-0 py-0"
                onClick={() => onCloseRef.current()}
                ref={closeButtonRef}
                type="button"
              >
                <X aria-hidden="true" size={20} weight="bold" />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
