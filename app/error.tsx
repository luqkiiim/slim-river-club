"use client";

import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-5 py-10">
      <section className="panel w-full p-6 text-center" role="alert">
        <WarningCircle aria-hidden className="mx-auto text-blush" size={38} weight="duotone" />
        <h1 className="mt-4 text-2xl font-semibold">We couldn’t load this screen</h1>
        <p className="mt-2 text-sm leading-6 text-ink/70">Your data is safe. Try loading the screen again.</p>
        <button className="primary-button mt-5 w-full" onClick={reset} type="button">
          <ArrowClockwise aria-hidden size={20} weight="bold" />
          Try again
        </button>
      </section>
    </main>
  );
}
