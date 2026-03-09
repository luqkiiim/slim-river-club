"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="secondary-button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await signOut({ callbackUrl: "/login", redirect: false });
          router.replace(result.url ?? "/login");
        })
      }
    >
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}
