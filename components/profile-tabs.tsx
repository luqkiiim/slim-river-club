"use client";

import { ClockCounterClockwise, SlidersHorizontal, UserCircle } from "@phosphor-icons/react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

type ProfileTab = "overview" | "history" | "rules";

const TAB_CONFIG = [
  { id: "overview", label: "Overview", icon: UserCircle },
  { id: "history", label: "History", icon: ClockCounterClockwise },
  { id: "rules", label: "Rules", icon: SlidersHorizontal },
] as const;

interface ProfileTabsProps {
  history: ReactNode;
  overview: ReactNode;
  rules: ReactNode;
}

export function ProfileTabs({ history, overview, rules }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabListRef = useRef<HTMLDivElement>(null);
  const content = { history, overview, rules };

  useEffect(() => {
    const hashTab = window.location.hash.replace("#", "") as ProfileTab;
    if (TAB_CONFIG.some((tab) => tab.id === hashTab)) {
      setActiveTab(hashTab);
    }
  }, []);

  function selectTab(tab: ProfileTab) {
    setActiveTab(tab);
    window.history.replaceState(null, "", `#${tab}`);
    window.requestAnimationFrame(() => {
      tabListRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TAB_CONFIG.length - 1
          : event.key === "ArrowRight"
            ? (index + 1) % TAB_CONFIG.length
            : (index - 1 + TAB_CONFIG.length) % TAB_CONFIG.length;
    const nextTab = TAB_CONFIG[nextIndex];
    selectTab(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div>
      <div
        ref={tabListRef}
        aria-label="Profile sections"
        className="sticky top-0 z-20 -mx-1 mb-5 grid grid-cols-3 gap-1 rounded-[18px] border border-black/[0.06] bg-cream/95 p-1 shadow-sm backdrop-blur"
        role="tablist"
      >
        {TAB_CONFIG.map((tab, index) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;

          return (
            <button
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              aria-controls={`${baseId}-${tab.id}-panel`}
              aria-selected={selected}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-2 text-sm font-semibold transition ${
                selected ? "bg-moss text-white shadow-sm" : "text-ink/70 hover:bg-sand/65 hover:text-moss"
              }`}
              id={`${baseId}-${tab.id}-tab`}
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              <Icon aria-hidden size={19} weight={selected ? "fill" : "regular"} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {TAB_CONFIG.map((tab) =>
        activeTab === tab.id ? (
          <div
            aria-labelledby={`${baseId}-${tab.id}-tab`}
            id={`${baseId}-${tab.id}-panel`}
            key={tab.id}
            role="tabpanel"
            tabIndex={0}
          >
            {content[tab.id]}
          </div>
        ) : null,
      )}
    </div>
  );
}
