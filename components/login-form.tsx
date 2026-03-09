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
    <div className="panel mx-auto w-full max-w-md p-7 sm:p-8">
      <div className="mb-8 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">One office group</p>
        <h1 className="text-3xl font-semibold [font-family:var(--font-heading)]">Log in</h1>
        <p className="text-sm text-ink/70">Track weight, monitor penalties, and keep the leaderboard honest.</p>
      </div>

      {registrationSuccess ? (
        <div className="mb-4 rounded-2xl border border-leaf/20 bg-leaf/10 px-4 py-3 text-sm text-moss">
          Account created. Sign in to continue.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mb-4 rounded-2xl border border-blush/25 bg-blush/10 px-4 py-3 text-sm text-[#8f4a36]">
          {errorMessage}
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Email</span>
          <input
            className="field"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Password</span>
          <input
            className="field"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button className="primary-button w-full" type="submit" disabled={isPending}>
          {isPending ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink/70">
        Need an account?{" "}
        <Link className="font-semibold text-moss underline-offset-4 hover:underline" href="/signup">
          Sign up
        </Link>
      </p>
      <p className="mt-3 text-sm text-ink/60">
        If the admin already prepared your profile, use the claim code they gave you on the sign-up page first.
      </p>
    </div>
  );
}
