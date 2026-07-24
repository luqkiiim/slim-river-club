"use client";

import {
  ChartLineUp,
  DotsThree,
  GearSix,
  House,
  UserCircle,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LogoutButton } from "@/components/logout-button";

type AppSection = "home" | "group" | "progress" | "admin";

interface AppChromeProps {
  active: AppSection;
  currentUserId?: string;
  currentUserName: string;
  isAdmin: boolean;
  isParticipant: boolean;
}

export function AppHeader({
  currentUserId,
  currentUserName,
  isAdmin,
  isParticipant,
}: Omit<AppChromeProps, "active">) {
  const accountHref = isParticipant && currentUserId ? `/users/${currentUserId}` : isAdmin ? "/admin" : "/dashboard";

  return (
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
        <Link
          aria-label={`Open ${currentUserName}'s account`}
          className="flex min-h-11 items-center gap-2 rounded-full px-1.5 py-1 text-sm font-semibold text-ink transition hover:text-moss sm:px-2"
          href={accountHref}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-sand text-moss">
            <UserCircle aria-hidden size={26} weight="duotone" />
          </span>
          <span className="max-w-24 truncate sm:max-w-40">{currentUserName}</span>
        </Link>
        <div className="hidden lg:block">
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav({
  active,
  currentUserId,
  currentUserName,
  isAdmin,
  isParticipant,
}: AppChromeProps) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const accountDialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);

    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
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
      moreButtonRef.current?.focus();
    };
  }, [moreOpen]);

  const homeActive = active === "home" && hash !== "#participants";
  const groupActive = active === "group" || (pathname === "/dashboard" && hash === "#participants");
  const thirdItem = isParticipant && currentUserId
    ? {
        href: `/users/${currentUserId}`,
        icon: ChartLineUp,
        label: "Progress",
        selected: active === "progress",
      }
    : {
        href: "/admin",
        icon: GearSix,
        label: "Admin",
        selected: active === "admin",
      };
  const ThirdIcon = thirdItem.icon;

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-cream/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(32,51,38,0.08)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-4">
          <MobileNavLink href="/dashboard" label="Home" selected={homeActive}>
            <House aria-hidden size={25} weight={homeActive ? "fill" : "regular"} />
          </MobileNavLink>
          <MobileNavLink href="/dashboard#participants" label="Group" selected={groupActive}>
            <UsersThree aria-hidden size={26} weight={groupActive ? "fill" : "regular"} />
          </MobileNavLink>
          <MobileNavLink href={thirdItem.href} label={thirdItem.label} selected={thirdItem.selected}>
            <ThirdIcon aria-hidden size={25} weight={thirdItem.selected ? "fill" : "regular"} />
          </MobileNavLink>
          <button
            ref={moreButtonRef}
            aria-controls="mobile-account-menu"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-medium text-ink/70 transition hover:text-moss"
            onClick={() => setMoreOpen(true)}
            type="button"
          >
            <DotsThree aria-hidden size={27} weight="bold" />
            More
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/35 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <button
            aria-label="Dismiss account menu"
            className="absolute inset-0 cursor-default"
            onClick={() => setMoreOpen(false)}
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
                onClick={() => setMoreOpen(false)}
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
                  onClick={() => setMoreOpen(false)}
                >
                  <UserCircle aria-hidden size={21} weight="bold" />
                  My profile
                </Link>
              ) : null}
              {isAdmin ? (
                <Link className="secondary-button justify-start" href="/admin" onClick={() => setMoreOpen(false)}>
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
      {selected ? <span aria-hidden className="absolute inset-x-4 -top-2 h-0.5 rounded-full bg-leaf" /> : null}
      {children}
      {label}
    </Link>
  );
}
