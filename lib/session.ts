import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth";

export async function requireSession() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export async function requireAdminSession() {
  const session = await requireSession();

  if (!session.user.isAdmin) {
    redirect("/dashboard");
  }

  return session;
}

export async function requireParticipantSession() {
  const session = await requireSession();

  if (!session.user.isParticipant) {
    redirect(session.user.isAdmin ? "/admin" : "/dashboard");
  }

  return session;
}
