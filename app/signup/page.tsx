import { prisma } from "@/lib/prisma";
import { SignupForm } from "@/components/signup-form";

export default async function SignupPage() {
  const allowAdminOnly = (await prisma.user.count()) === 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6">
      <div className="grid w-full gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">
            {allowAdminOnly ? "Create the group" : "Join the group"}
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-tight [font-family:var(--font-heading)] sm:text-5xl">
            {allowAdminOnly
              ? "Create the first account for the group, with or without personal weight tracking."
              : "Use your claim code to connect your login to the profile your admin already prepared."}
          </h1>
          <p className="mt-4 max-w-xl text-base text-ink/72">
            {allowAdminOnly
              ? "If you are only managing the office group, you can create the initial admin account without entering your own weight."
              : "Your historical data and monthly results stay with the profile, so you only need to claim it once with your code."}
          </p>
        </section>

        <SignupForm allowAdminOnly={allowAdminOnly} />
      </div>
    </main>
  );
}
