"use client";

import {
  ChartLineUp,
  GearSix,
  House,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { LogWeightModal } from "@/components/log-weight-modal";
import { LogoutButton } from "@/components/logout-button";
import { ParticipantAvatar } from "@/components/participant-avatar";

type AppSection = "home" | "progress" | "admin";

interface AppChromeProps {
  active: AppSection;
  canLogWeight?: boolean;
  currentUserId?: string;
  currentUserAvatarUrl?: string | null;
  currentUserName: string;
  isAdmin: boolean;
  isParticipant: boolean;
}

export function AppHeader({
  currentUserId,
  currentUserAvatarUrl,
  currentUserName,
  isAdmin,
  isParticipant,
}: Omit<AppChromeProps, "active" | "canLogWeight">) {
  const [accountOpen, setAccountOpen] = useState(false);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const accountDialogRef = useRef<HTMLElement>(null);
  const accountHref = isParticipant && currentUserId ? `/users/${currentUserId}` : isAdmin ? "/admin" : "/dashboard";

  useEffect(() => {
    if (!accountOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        return;
      }

      if (event.key !== "Tab" || !accountDialogRef.current) {
        return;
      }

      const focusable = Array.from(
        accountDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      accountButtonRef.current?.focus();
    };
  }, [accountOpen]);

  return (
    <>
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:pt-6">
        <Link
          className="text-[13px] font-semibold uppercase tracking-[0.28em] text-moss sm:text-sm"
          href="/dashboard"
        >
          Slim River Club
        </Link>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Link className="secondary-button hidden lg:inline-flex" href="/admin">
              <GearSix aria-hidden size={20} weight="bold" />
              Admin
            </Link>
          ) : null}

          <button
            ref={accountButtonRef}
            aria-controls="mobile-account-menu"
            aria-expanded={accountOpen}
            aria-haspopup="dialog"
            aria-label={`Open ${currentUserName}'s account menu`}
            className="flex min-h-11 items-center gap-2 rounded-full px-1.5 py-1 text-sm font-semibold text-ink transition hover:text-moss sm:px-2 lg:hidden"
            onClick={() => setAccountOpen(true)}
            type="button"
          >
            <ParticipantAvatar avatarUrl={currentUserAvatarUrl ?? null} name={currentUserName} size="sm" />
            <span className="max-w-24 truncate sm:max-w-40">{currentUserName}</span>
          </button>

          <Link
            aria-label={`Open ${currentUserName}'s account`}
            className="hidden min-h-11 items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-ink transition hover:text-moss lg:flex"
            href={accountHref}
          >
            <ParticipantAvatar avatarUrl={currentUserAvatarUrl ?? null} name={currentUserName} size="sm" />
            <span className="max-w-40 truncate">{currentUserName}</span>
          </Link>

          <div className="hidden lg:block">
            <LogoutButton />
          </div>
        </div>
      </header>

      {accountOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/35 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <button
            aria-label="Dismiss account menu"
            className="absolute inset-0 cursor-default"
            onClick={() => setAccountOpen(false)}
            type="button"
          />
          <section
            ref={accountDialogRef}
            aria-labelledby="account-menu-title"
            aria-modal="true"
            className="panel relative mx-auto w-full max-w-xl p-5"
            id="mobile-account-menu"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Account</p>
                <h2 className="mt-1 text-2xl font-semibold" id="account-menu-title">
                  {currentUserName}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                aria-label="Close account menu"
                className="icon-button"
                onClick={() => setAccountOpen(false)}
                type="button"
              >
                <X aria-hidden size={21} weight="bold" />
              </button>
            </div>

            <div className="mt-5 grid gap-2">
              {isParticipant && currentUserId ? (
                <Link
                  className="secondary-button justify-start"
                  href={`/users/${currentUserId}`}
                  onClick={() => setAccountOpen(false)}
                >
                  <ParticipantAvatar avatarUrl={currentUserAvatarUrl ?? null} name={currentUserName} size="sm" />
                  My profile
                </Link>
              ) : null}
              {isAdmin ? (
                <Link className="secondary-button justify-start" href="/admin" onClick={() => setAccountOpen(false)}>
                  <GearSix aria-hidden size={21} weight="bold" />
                  Admin workspace
                </Link>
              ) : null}
              <LogoutButton className="w-full justify-start" />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export function MobileBottomNav({
  active,
  canLogWeight = false,
  currentUserId,
  currentUserName,
  isAdmin,
  isParticipant,
}: AppChromeProps) {
  if (isParticipant && currentUserId) {
    return (
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-cream/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(32,51,38,0.08)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-3 items-end">
          <MobileNavLink href="/dashboard" label="Home" selected={active === "home"}>
            <House aria-hidden size={25} weight={active === "home" ? "fill" : "regular"} />
          </MobileNavLink>
          <LogWeightModal currentUserName={currentUserName} disabled={!canLogWeight} triggerVariant="nav" />
          <MobileNavLink href={`/users/${currentUserId}`} label="Progress" selected={active === "progress"}>
            <ChartLineUp aria-hidden size={25} weight={active === "progress" ? "fill" : "regular"} />
          </MobileNavLink>
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-cream/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(32,51,38,0.08)] backdrop-blur-md lg:hidden"
    >
      <div className={`mx-auto grid max-w-xl ${isAdmin ? "grid-cols-2" : "grid-cols-1"}`}>
        <MobileNavLink href="/dashboard" label="Home" selected={active === "home"}>
          <House aria-hidden size={25} weight={active === "home" ? "fill" : "regular"} />
        </MobileNavLink>
        {isAdmin ? (
          <MobileNavLink href="/admin" label="Admin" selected={active === "admin"}>
            <GearSix aria-hidden size={25} weight={active === "admin" ? "fill" : "regular"} />
          </MobileNavLink>
        ) : null}
      </div>
    </nav>
  );
}

function MobileNavLink({
  children,
  href,
  label,
  selected,
}: {
  children: React.ReactNode;
  href: string;
  label: string;
  selected: boolean;
}) {
  return (
    <Link
      aria-current={selected ? "page" : undefined}
      className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium transition ${
        selected ? "text-moss" : "text-ink/70 hover:text-moss"
      }`}
      href={href}
    >
      {selected ? <span aria-hidden className="absolute inset-x-8 -top-2 h-0.5 rounded-full bg-leaf" /> : null}
      {children}
      {label}
    </Link>
  );
}
