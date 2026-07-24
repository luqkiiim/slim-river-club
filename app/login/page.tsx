import { AuthShell } from "@/components/auth-shell";
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
    <AuthShell
      supportEyebrow="Your club, at a glance"
      supportTitle="A calmer way to stay accountable."
      supportBody="See what matters today, keep your monthly target clear, and celebrate steady progress with the group."
      supportPoints={["Your current target and pace", "Simple weigh-ins without the clutter", "Private weight details when you need them"]}
    >
      <LoginForm
        initialEmail={firstValue(params.email)}
        registrationSuccess={firstValue(params.registered) === "1"}
        initialError={firstValue(params.error)}
      />
    </AuthShell>
  );
}
