"use client";

import { useState } from "react";

interface CopyValueFieldProps {
  value: string;
  buttonLabel?: string;
}

export function CopyValueField({ value, buttonLabel = "Copy" }: CopyValueFieldProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <input className="field min-w-0 flex-1 text-xs" value={value} readOnly />
      <button type="button" className="secondary-button px-4 py-2 text-sm" onClick={handleCopy}>
        {copied ? "Copied" : buttonLabel}
      </button>
    </div>
  );
}
