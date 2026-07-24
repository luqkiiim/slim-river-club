import Link from "next/link";
import type { ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
  supportEyebrow: string;
  supportTitle: string;
  supportBody: string;
  supportPoints: readonly string[];
}

export function AuthShell({
  children,
  supportEyebrow,
  supportTitle,
  supportBody,
  supportPoints,
}: AuthShellProps) {
  return (
    <main
      className="mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <header className="flex min-h-12 items-center justify-between gap-4">
        <Link
          className="text-sm font-semibold uppercase tracking-[0.28em] text-moss outline-none transition hover:text-ink focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-4 focus-visible:ring-offset-cream"
          href="/login"
          aria-label="Slim River Club login"
        >
          Slim River Club
        </Link>
        <p className="hidden text-sm text-ink/70 sm:block">Personal progress, shared momentum.</p>
      </header>

      <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14 lg:py-12">
        <section className="hidden rounded-[32px] border border-black/5 bg-sand/65 p-9 lg:block lg:p-11">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-moss">{supportEyebrow}</p>
          <h2 className="mt-4 max-w-md text-4xl font-semibold leading-[1.08] [font-family:var(--font-heading)]">
            {supportTitle}
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-ink/68">{supportBody}</p>

          <div className="mt-10 divide-y divide-black/10 border-y border-black/10">
            {supportPoints.map((point, index) => (
              <div key={point} className="flex items-center gap-4 py-4">
                <span className="font-mono text-xs font-medium text-moss/65">{`${index + 1}`.padStart(2, "0")}</span>
                <p className="text-sm font-medium text-ink/80">{point}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto w-full max-w-lg">{children}</div>
      </div>
    </main>
  );
}
