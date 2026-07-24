"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

interface CopyValueFieldProps {
  value: string;
  buttonLabel?: string;
}

export function CopyValueField({ value, buttonLabel = "Copy" }: CopyValueFieldProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    },
    [],
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => setCopyState("idle"), 1800);
  }

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor={`copy-value-${value}`}>Value to copy</label>
      <input
        aria-describedby={`copy-status-${value}`}
        className="field min-w-0 flex-1 font-mono text-base"
        id={`copy-value-${value}`}
        value={value}
        readOnly
      />
      <button type="button" className="secondary-button px-4 py-2 text-sm" onClick={handleCopy}>
        {copyState === "copied" ? <Check aria-hidden size={18} weight="bold" /> : <Copy aria-hidden size={18} weight="bold" />}
        {copyState === "copied" ? "Copied" : buttonLabel}
      </button>
      <span
        aria-live={copyState === "error" ? "assertive" : "polite"}
        className="sr-only"
        id={`copy-status-${value}`}
        role={copyState === "error" ? "alert" : "status"}
      >
        {copyState === "copied" ? "Copied to clipboard." : copyState === "error" ? "Could not copy. Select the value manually." : ""}
      </span>
    </div>
  );
}
