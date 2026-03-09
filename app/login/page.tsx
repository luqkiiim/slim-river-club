import { LoginForm } from "@/components/login-form";

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    registered?: string | string[];
    email?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6">
      <div className="grid w-full gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">Office weight loss tracker</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight [font-family:var(--font-heading)] sm:text-5xl">
            Stay accountable, track progress, and auto-calculate each participant&apos;s monthly penalty.
          </h1>
          <p className="mt-4 max-w-xl text-base text-ink/72">
            Built for a single office group with shared visibility, personal charts, and admin controls.
          </p>
        </section>

        <LoginForm
          initialEmail={firstValue(params.email)}
          registrationSuccess={firstValue(params.registered) === "1"}
          initialError={firstValue(params.error)}
        />
      </div>
    </main>
  );
}
