"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "next-auth/react";
import { SignOut } from "@phosphor-icons/react";

export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={`secondary-button ${className}`}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await signOut({ callbackUrl: "/login", redirect: false });
          router.replace(result.url ?? "/login");
        })
      }
    >
      <SignOut aria-hidden size={20} weight="bold" />
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
