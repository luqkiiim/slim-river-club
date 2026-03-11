"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

interface AdminSheetProps {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}

export function AdminSheet({ children, description, onClose, open, title }: AdminSheetProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />

      <div className="absolute inset-x-0 bottom-0 top-16 mx-auto flex max-w-6xl items-end justify-end px-3 pb-3 sm:px-6 sm:pb-6">
        <section className="flex max-h-full w-full overflow-hidden rounded-[32px] border border-black/10 bg-cream/95 shadow-[0_24px_90px_rgba(31,42,31,0.18)] backdrop-blur xl:max-w-3xl">
          <div className="flex w-full min-w-0 flex-col">
            <div className="border-b border-black/5 px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-moss">Admin workspace</p>
                  <h2 className="mt-2 text-2xl font-semibold [font-family:var(--font-heading)] text-ink">{title}</h2>
                  {description ? <p className="mt-2 max-w-2xl text-sm text-ink/65">{description}</p> : null}
                </div>
                <button
                  className="secondary-button h-10 w-10 shrink-0 px-0 py-0 text-base"
                  onClick={onClose}
                  type="button"
                >
                  x
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
