"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { signIn } from "next-auth/react";

interface LoginFormProps {
  initialEmail?: string;
  registrationSuccess?: boolean;
  initialError?: string | null;
}

export function LoginForm({ initialEmail, registrationSuccess, initialError }: LoginFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError === "CredentialsSignin" ? "Invalid email or password." : null,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/",
      });

      if (result?.error) {
        setErrorMessage("Invalid email or password.");
        return;
      }

      router.replace(result?.url ?? "/");
    });
  }

  return (
    <section className="w-full rounded-[30px] border border-black/5 bg-cream/95 p-5 shadow-[0_18px_48px_rgba(35,49,35,0.10)] backdrop-blur-sm sm:p-8">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-moss">Welcome back</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight [font-family:var(--font-heading)] sm:text-4xl">
          Log in to your club
        </h1>
        <p className="mt-3 max-w-md text-base leading-6 text-ink/70">
          Check your monthly target, see the group&apos;s momentum, or add your latest weigh-in.
        </p>
      </div>

      {registrationSuccess ? (
        <div
          id="login-registration-feedback"
          className="mb-4 rounded-2xl border border-leaf/20 bg-leaf/10 px-4 py-3 text-sm font-medium text-moss"
          role="status"
          aria-live="polite"
        >
          Account created. Sign in to continue.
        </div>
      ) : null}

      {errorMessage ? (
        <div
          id="login-error-feedback"
          className="mb-4 rounded-2xl border border-blush/25 bg-blush/10 px-4 py-3 text-sm font-medium text-[#8f4a36]"
          role="alert"
          aria-live="assertive"
        >
          {errorMessage}
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit} aria-busy={isPending}>
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Email</span>
          <input
            className="field min-h-12 text-base"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby={
              [registrationSuccess ? "login-registration-feedback" : null, errorMessage ? "login-error-feedback" : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            aria-invalid={Boolean(errorMessage)}
            required
          />
        </label>

        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Password</span>
          <input
            className="field min-h-12 text-base"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={errorMessage ? "login-error-feedback" : undefined}
            aria-invalid={Boolean(errorMessage)}
            required
          />
        </label>

        <button className="primary-button min-h-12 w-full text-base" type="submit" disabled={isPending}>
          {isPending ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/70">
        Need an account?{" "}
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-moss underline-offset-4 outline-none hover:underline focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-leaf"
          href="/signup"
        >
          Sign up
        </Link>
      </p>
      <p className="rounded-2xl bg-sand/55 px-4 py-3 text-sm leading-6 text-ink/70">
        Have a claim code? Sign up first to connect it to the profile your admin prepared.
      </p>
    </section>
  );
}
