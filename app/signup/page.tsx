import { AuthShell } from "@/components/auth-shell";
import { prisma } from "@/lib/prisma";
import { SignupForm } from "@/components/signup-form";

export default async function SignupPage() {
  const allowAdminOnly = (await prisma.user.count()) === 0;

  return (
    <AuthShell
      supportEyebrow={allowAdminOnly ? "Start the club" : "Join your group"}
      supportTitle={allowAdminOnly ? "Set up the group in a few clear steps." : "Your progress is already waiting for you."}
      supportBody={
        allowAdminOnly
          ? "Create the first account, then decide whether this admin will also join the tracked participant roster."
          : "Use the claim code from your admin to connect securely to your existing participant profile and history."
      }
      supportPoints={
        allowAdminOnly
          ? ["Admin access from day one", "Optional personal weight tracking", "Participant setup after sign-in"]
          : ["Keep your existing progress history", "Create your own secure password", "Claim your profile only once"]
      }
    >
      <SignupForm allowAdminOnly={allowAdminOnly} />
    </AuthShell>
  );
}
