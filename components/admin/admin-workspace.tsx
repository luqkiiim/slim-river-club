"use client";

import {
  CaretRight,
  DotsThree,
  Plus,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { AdminSheet } from "@/components/admin/admin-sheet";
import { CopyValueField } from "@/components/copy-value-field";
import { CreateParticipantForm } from "@/components/create-participant-form";
import { DeleteWeightEntryForm } from "@/components/delete-weight-entry-form";
import { DeleteUserForm } from "@/components/delete-user-form";
import {
  createPrivateProgressEntryAction,
  createWeightEntryAction,
  deleteMonthPolicyAction,
  deleteUserMonthPolicyAction,
  upsertMonthPolicyAction,
  upsertUserMonthPolicyAction,
  updateAdminPrivacyModeAction,
  updateChallengeStartDateAction,
  updateHeightAction,
  updateMonthlyLossTargetAction,
  updateMonthlyPenaltyAction,
  updatePrivateProgressEntryAction,
  updateStartWeightAction,
  updateTargetLossAction,
  updateTargetWeightAction,
  updateUserRoleAction,
  updateWeightEntryAction,
} from "@/lib/actions/admin-actions";
import {
  currentDateInputValue,
  currentMonthInputValue,
  formatDate,
  formatDateInput,
  formatLossDelta,
  formatMonthInput,
  formatRm,
  formatWeight,
  getMonthLabel,
} from "@/lib/weight-utils";
import type {
  AdminEntrySummary,
  AdminUserSummary,
  MonthPolicySummary,
} from "@/types/app";

type WorkspaceTab = "participants" | "claims" | "settings";
type ParticipantEditorTab = "overview" | "targets" | "history";

interface AdminWorkspaceProps {
  entries: AdminEntrySummary[];
  monthPolicies: MonthPolicySummary[];
  sessionUserId: string;
  users: AdminUserSummary[];
}

function SummaryTile({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-black/5 bg-white/70 p-3 sm:p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/70">{label}</p>
      <p className="mt-1 break-words text-xl font-semibold leading-tight [font-family:var(--font-heading)] text-ink sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs leading-5 text-ink/70 sm:text-sm">{detail}</p>
    </div>
  );
}

function PendingSubmitButton({
  children,
  className,
  pendingLabel,
}: {
  children: ReactNode;
  className: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button aria-disabled={pending} className={className} disabled={pending} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}

function WorkspaceSection({
  action,
  children,
  description,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-[24px] border border-black/5 bg-white/75 p-4 shadow-[0_10px_32px_rgba(31,42,31,0.05)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold leading-tight [font-family:var(--font-heading)] text-ink">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-ink/70">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EditorSection({
  children,
  description,
  tone = "default",
  title,
}: {
  children: ReactNode;
  description: string;
  tone?: "danger" | "default";
  title: string;
}) {
  const className =
    tone === "danger"
      ? "rounded-[22px] border border-[#e6c8c0] bg-[#fff5f2] p-4"
      : "rounded-[22px] border border-black/5 bg-white/60 p-4";

  return (
    <section className={className}>
      <div className="mb-3">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-ink/70">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SettingBlock({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/70">{label}</p>
      {children}
    </div>
  );
}

function getParticipantState(user: AdminUserSummary) {
  if (!user.hasLoginAccess) {
    return "Claim pending";
  }

  if (user.goalReached) {
    return "Goal reached";
  }

  return user.isPrivate ? "Private tracking" : "Active participant";
}

function getParticipantStateTone(user: AdminUserSummary) {
  if (!user.hasLoginAccess) {
    return "bg-sand text-ink/75";
  }

  if (user.goalReached) {
    return "bg-leaf/15 text-moss";
  }

  return user.isPrivate ? "bg-[#f4dfb2] text-[#7f5b17]" : "bg-[#dbe9dd] text-moss";
}

function ActionMenu({
  accessibleLabel = "More actions",
  items,
}: {
  accessibleLabel?: string;
  items: Array<{
    href?: string;
    label: string;
    onSelect?: () => void;
  }>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <details className="relative">
      <summary
        aria-label={accessibleLabel}
        className="secondary-button flex h-11 w-11 list-none items-center justify-center px-0 py-0 [&::-webkit-details-marker]:hidden"
      >
        <DotsThree aria-hidden="true" size={22} weight="bold" />
      </summary>

      <div className="absolute right-0 z-20 mt-2 min-w-44 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg">
        {items.map((item) =>
          item.href ? (
            <Link
              key={item.label}
              className="block px-4 py-3 text-sm font-medium text-ink transition hover:bg-sand/60"
              href={item.href}
            >
              {item.label}
            </Link>
          ) : (
            <button
              key={item.label}
              className="block w-full px-4 py-3 text-left text-sm font-medium text-ink transition hover:bg-sand/60"
              onClick={(event) => {
                item.onSelect?.();
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
              type="button"
            >
              {item.label}
            </button>
          ),
        )}
      </div>
    </details>
  );
}

function RosterMetric({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0 sm:rounded-2xl sm:bg-white/80 sm:px-3 sm:py-3">
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-ink/70 sm:text-xs">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-ink">{value}</p>
      <p className="mt-1 hidden text-xs text-ink/70 sm:block">{detail}</p>
    </div>
  );
}

function ParticipantSummaryRow({
  children,
  chips,
  description,
  label,
  manageLabel,
  metrics,
  onManage,
}: {
  children?: ReactNode;
  chips: ReactNode;
  description: string;
  label: ReactNode;
  manageLabel: string;
  metrics: Array<{ detail: string; label: string; value: string }>;
  onManage: () => void;
}) {
  return (
    <article className="rounded-[22px] border border-black/8 bg-white/90 p-4 shadow-[0_8px_24px_rgba(31,42,31,0.045)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="min-w-0">
            {label}
            <p className="mt-1 truncate text-sm text-ink/70">{description}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">{chips}</div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label={manageLabel}
            className="secondary-button min-h-11 px-3 py-2"
            onClick={onManage}
            type="button"
          >
            Manage
          </button>
          {children}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 divide-x divide-black/5 border-t border-black/5 pt-3 sm:gap-3 sm:divide-x-0 sm:border-t-0 sm:pt-0 xl:mt-4">
        {metrics.map((metric) => (
          <RosterMetric
            key={metric.label}
            detail={metric.detail}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </div>
    </article>
  );
}

function StatusChip({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return <span className={`status-chip ${className}`}>{label}</span>;
}

function ParticipantRow({
  onManage,
  user,
}: {
  onManage: () => void;
  user: AdminUserSummary;
}) {
  const currentLabel = user.isPrivate ? "Lost" : "Current";
  const currentValue = user.isPrivate
    ? formatWeight(user.totalKgLost)
    : user.currentWeight !== null
      ? formatWeight(user.currentWeight)
      : "No entries";
  const currentDetail = user.isPrivate
    ? user.needsStartingWeight
      ? "Starting weight pending"
      : `${user.progressPct}% overall`
    : user.heightCm !== null
      ? `${user.heightCm} cm height saved`
      : `${user.progressPct}% overall`;
  const targetLabel = user.isPrivate ? "Target loss" : "Target";
  const targetValue = user.isPrivate
    ? user.targetLossKg !== null
      ? formatWeight(user.targetLossKg)
      : "Not set"
    : user.targetWeight !== null
      ? formatWeight(user.targetWeight)
      : "Not set";
  const targetDetail = user.isPrivate ? "Private mode" : `${formatWeight(user.totalKgLost)} lost so far`;
  const rulesValue = `${formatWeight(user.monthlyLossTargetKg)} / mo`;
  const rulesDetail = `${formatRm(user.monthlyPenaltyRm)} if missed`;

  return (
    <ParticipantSummaryRow
      chips={
        <>
          <StatusChip className={getParticipantStateTone(user)} label={getParticipantState(user)} />
          <StatusChip className="bg-sand text-ink/75" label={user.isPrivate ? "Private" : "Public"} />
          {user.isAdmin ? <StatusChip className="bg-white text-ink/70" label="Admin access" /> : null}
        </>
      }
      description={user.email ?? "No email linked yet"}
      label={<h3 className="truncate text-xl font-semibold [font-family:var(--font-heading)] text-ink">{user.name}</h3>}
      metrics={[
        { label: currentLabel, value: currentValue, detail: currentDetail },
        { label: targetLabel, value: targetValue, detail: targetDetail },
        { label: "Rules", value: rulesValue, detail: rulesDetail },
      ]}
      manageLabel={`Manage ${user.name}`}
      onManage={onManage}
    >
      <ActionMenu
        accessibleLabel={`More actions for ${user.name}`}
        items={[
          { href: `/users/${user.id}`, label: "View profile" },
        ]}
      />
    </ParticipantSummaryRow>
  );
}

function AdminAccessRow({
  onManage,
  user,
}: {
  onManage: () => void;
  user: AdminUserSummary;
}) {
  return (
    <ParticipantSummaryRow
      chips={
        <>
          <StatusChip className="bg-sand text-ink/75" label="Admin-only" />
          {user.isAdmin ? <StatusChip className="bg-white text-ink/70" label="Admin" /> : null}
        </>
      }
      description={user.email ?? "No email linked yet"}
      label={<h3 className="truncate text-xl font-semibold [font-family:var(--font-heading)] text-ink">{user.name}</h3>}
      metrics={[
        { label: "Access", value: user.isAdmin ? "Admin" : "Member", detail: "Role can still be changed" },
        { label: "Tracking", value: "Excluded", detail: "No participant accountability rules" },
        { label: "Status", value: "Workspace only", detail: "Management account" },
      ]}
      manageLabel={`Manage ${user.name}`}
      onManage={onManage}
    />
  );
}

function ClaimRow({
  onManage,
  user,
}: {
  onManage: () => void;
  user: AdminUserSummary;
}) {
  const targetLabel = user.isPrivate ? "Target loss" : "Target";
  const targetValue = user.isPrivate
    ? user.targetLossKg !== null
      ? formatWeight(user.targetLossKg)
      : "Not set"
    : user.targetWeight !== null
      ? formatWeight(user.targetWeight)
      : "Not set";
  const challengeStart = user.challengeStartDateIso
    ? formatDate(new Date(user.challengeStartDateIso))
    : "Not set";

  return (
    <ParticipantSummaryRow
      chips={
        <>
          <StatusChip className="bg-sand text-ink/75" label="Claim pending" />
          <StatusChip className="bg-white text-ink/70" label={user.isPrivate ? "Private profile" : "Public profile"} />
          {user.claimCode ? <StatusChip className="bg-[#dbe9dd] text-moss" label="Code ready" /> : null}
        </>
      }
      description="Ready for backfill, review, and code sharing."
      label={<h3 className="truncate text-xl font-semibold [font-family:var(--font-heading)] text-ink">{user.name}</h3>}
      metrics={[
        { label: targetLabel, value: targetValue, detail: user.isPrivate ? "Raw weight hidden" : "Visible profile mode" },
        { label: "Challenge start", value: challengeStart, detail: "First penalizable full month follows this" },
        {
          label: "History",
          value: user.needsStartingWeight ? "Baseline pending" : "Ready",
          detail: user.isPrivate ? "Use private change logs" : "Use public weigh-ins",
        },
      ]}
      manageLabel={`Manage ${user.name}`}
      onManage={onManage}
    >
      <ActionMenu
        accessibleLabel={`More actions for ${user.name}`}
        items={[
          { href: `/users/${user.id}`, label: "View profile" },
          ...(user.claimCode
            ? [
                {
                  label: "Copy claim code",
                  onSelect: () => {
                    void navigator.clipboard.writeText(user.claimCode ?? "");
                  },
                },
              ]
            : []),
        ]}
      />
    </ParticipantSummaryRow>
  );
}

function EntryEditor({
  entry,
}: {
  entry: AdminEntrySummary;
}) {
  const entryDate = formatDate(new Date(entry.isoDate));
  const valueLabel =
    entry.entryType === "ABSOLUTE" && entry.visibleWeight !== null
      ? formatWeight(entry.visibleWeight)
      : entry.lossKg !== null
        ? formatLossDelta(entry.lossKg)
        : "entry";

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{entryDate}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/70">
            {entry.entryType === "ABSOLUTE" ? "Weight entry" : entry.userIsPrivate ? "Private change" : "Change log"}
          </p>
        </div>

        <div className="text-right">
          {entry.userIsPrivate ? (
            <>
              <p className="font-semibold text-ink">{formatWeight(entry.totalKgLost)} total lost</p>
              <p className="mt-1 text-xs text-ink/70">{entry.lossKg !== null ? formatLossDelta(entry.lossKg) : "Private"}</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-ink">
                {entry.visibleWeight !== null ? formatWeight(entry.visibleWeight) : "Not available"}
              </p>
              {entry.entryType === "LOSS_DELTA" && entry.lossKg !== null ? (
                <p className="mt-1 text-xs text-ink/70">{formatLossDelta(entry.lossKg)}</p>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="mt-4">
        {entry.entryType === "ABSOLUTE" ? (
          <form action={updateWeightEntryAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input name="entryId" type="hidden" value={entry.id} />
            <input name="userId" type="hidden" value={entry.userId} />
            <label className="space-y-1 text-sm font-medium text-ink">
              <span>Weight (kg)</span>
              <input
                className="field min-w-0"
                defaultValue={entry.weight ?? undefined}
                min="1"
                name="weight"
                required
                step="0.01"
                type="number"
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-ink">
              <span>Date</span>
              <input
                className="field min-w-0"
                defaultValue={formatDateInput(new Date(entry.isoDate))}
                name="date"
                required
                type="date"
              />
            </label>
            <button className="secondary-button min-h-11 px-4 py-2 md:self-end" type="submit">
              Save entry
            </button>
          </form>
        ) : (
          <form action={updatePrivateProgressEntryAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input name="entryId" type="hidden" value={entry.id} />
            <input name="userId" type="hidden" value={entry.userId} />
            <label className="space-y-1 text-sm font-medium text-ink">
              <span>Loss change (kg)</span>
              <input
                className="field min-w-0"
                defaultValue={entry.lossKg ?? undefined}
                name="lossKg"
                required
                step="0.01"
                type="number"
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-ink">
              <span>Date</span>
              <input
                className="field min-w-0"
                defaultValue={formatDateInput(new Date(entry.isoDate))}
                name="date"
                required
                type="date"
              />
            </label>
            <button className="secondary-button min-h-11 px-4 py-2 md:self-end" type="submit">
              Save update
            </button>
          </form>
        )}
      </div>

      <div className="mt-3">
        <DeleteWeightEntryForm
          entryDate={entryDate}
          entryId={entry.id}
          userName={entry.userName}
          valueLabel={valueLabel}
        />
      </div>
    </article>
  );
}

function PersonalMonthTargets({
  monthPolicies,
  user,
}: {
  monthPolicies: MonthPolicySummary[];
  user: AdminUserSummary;
}) {
  const initialMonth = currentMonthInputValue();
  const initialPolicy = user.personalMonthPolicies.find(
    (policy) => formatMonthInput(policy.year, policy.month) === initialMonth,
  );
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [requiredTargetPct, setRequiredTargetPct] = useState(
    `${initialPolicy?.requiredTargetPct ?? 75}`,
  );
  const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
  const selectedGroupPolicy = monthPolicies.find(
    (policy) => policy.year === selectedYear && policy.month === selectedMonthNumber,
  );
  const parsedTargetPct = Number(requiredTargetPct);
  const hasValidPreview = Number.isFinite(parsedTargetPct) && parsedTargetPct >= 1 && parsedTargetPct <= 200;
  const previewRequiredLossKg = hasValidPreview
    ? (user.monthlyLossTargetKg * parsedTargetPct) / 100
    : null;
  const fallbackTargetPct = selectedGroupPolicy?.requiredTargetPct ?? 100;
  const fallbackRequiredLossKg = (user.monthlyLossTargetKg * fallbackTargetPct) / 100;
  const selectedMonthLabel = selectedYear && selectedMonthNumber
    ? getMonthLabel(selectedMonthNumber, selectedYear)
    : "the selected month";

  function handleMonthChange(value: string) {
    setSelectedMonth(value);

    const [year, month] = value.split("-").map(Number);
    const existingPolicy = user.personalMonthPolicies.find(
      (policy) => policy.year === year && policy.month === month,
    );

    setRequiredTargetPct(`${existingPolicy?.requiredTargetPct ?? 75}`);
  }

  return (
    <EditorSection
      description="Set an exception for this participant only. It replaces any group rule for the same month."
      title="Personal month targets"
    >
      <form action={upsertUserMonthPolicyAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input name="userId" type="hidden" value={user.id} />
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Month</span>
          <input
            className="field"
            name="month"
            onChange={(event) => handleMonthChange(event.target.value)}
            required
            type="month"
            value={selectedMonth}
          />
        </label>
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Required % of normal target</span>
          <input
            className="field"
            max="200"
            min="1"
            name="requiredTargetPct"
            onChange={(event) => setRequiredTargetPct(event.target.value)}
            required
            step="1"
            type="number"
            value={requiredTargetPct}
          />
        </label>
        <div className="flex items-end">
          <button className="primary-button min-h-11 w-full md:w-auto" type="submit">
            Save personal rule
          </button>
        </div>
      </form>

      <div className="mt-3 rounded-2xl bg-sand/45 px-4 py-3 text-sm text-ink/70">
        {parsedTargetPct === 100 ? (
          <p>
            Saving 100% removes the personal rule. The {fallbackTargetPct}% fallback will require{" "}
            <span className="font-semibold text-ink">{formatWeight(fallbackRequiredLossKg)}</span> in{" "}
            {selectedMonthLabel}.
          </p>
        ) : previewRequiredLossKg !== null ? (
          <p>
            {parsedTargetPct}% requires{" "}
            <span className="font-semibold text-ink">{formatWeight(previewRequiredLossKg)}</span> instead of{" "}
            {formatWeight(user.monthlyLossTargetKg)} in {selectedMonthLabel}.
            {selectedGroupPolicy ? ` This replaces the ${selectedGroupPolicy.requiredTargetPct}% group rule.` : ""}
          </p>
        ) : (
          <p>Enter a percentage from 1% to 200% to preview the required loss.</p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {user.personalMonthPolicies.length === 0 ? (
          <ParticipantEmptyState message="No personal month targets yet." />
        ) : (
          user.personalMonthPolicies.map((policy) => {
            const groupPolicy = monthPolicies.find(
              (candidate) => candidate.year === policy.year && candidate.month === policy.month,
            );
            const requiredLossKg = (user.monthlyLossTargetKg * policy.requiredTargetPct) / 100;

            return (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white/80 px-4 py-3"
                key={policy.id}
              >
                <div>
                  <p className="font-semibold text-ink">{getMonthLabel(policy.month, policy.year)}</p>
                  <p className="mt-1 text-sm text-ink/70">
                    Personal {policy.requiredTargetPct}% · {formatWeight(requiredLossKg)} required
                  </p>
                  <p className="mt-1 text-xs font-medium text-moss">
                    {groupPolicy
                      ? `Overrides the ${groupPolicy.requiredTargetPct}% group rule`
                      : "Overrides the normal 100% target"}
                  </p>
                </div>
                <form action={deleteUserMonthPolicyAction}>
                  <input name="policyId" type="hidden" value={policy.id} />
                  <button
                    aria-label={`Remove personal target for ${getMonthLabel(policy.month, policy.year)}`}
                    className="secondary-button min-h-11 px-4 py-2"
                    type="submit"
                  >
                    Remove
                  </button>
                </form>
              </div>
            );
          })
        )}
      </div>
    </EditorSection>
  );
}

function ParticipantEditor({
  adminCount,
  entries,
  monthPolicies,
  sessionUserId,
  user,
}: {
  adminCount: number;
  entries: AdminEntrySummary[];
  monthPolicies: MonthPolicySummary[];
  sessionUserId: string;
  user: AdminUserSummary;
}) {
  const [editorTab, setEditorTab] = useState<ParticipantEditorTab>("overview");
  const editorRootRef = useRef<HTMLDivElement>(null);
  const challengeStartLabel = user.challengeStartDateIso
    ? formatDate(new Date(user.challengeStartDateIso))
    : "Not set";
  const currentLabel = user.isPrivate ? "Total lost" : "Current";
  const currentValue = user.isPrivate
    ? `${formatWeight(user.totalKgLost)} lost`
    : user.currentWeight !== null
      ? formatWeight(user.currentWeight)
      : "No entries yet";
  const targetLabel = user.isPrivate ? "Target loss" : "Target weight";
  const targetValue = user.isPrivate
    ? user.targetLossKg !== null
      ? formatWeight(user.targetLossKg)
      : "Not set"
    : user.targetWeight !== null
      ? formatWeight(user.targetWeight)
      : "Not set";
  const editorTabs: Array<{ key: ParticipantEditorTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "targets", label: "Targets" },
    { key: "history", label: "History" },
  ];

  function selectEditorTab(nextTab: ParticipantEditorTab) {
    setEditorTab(nextTab);
    window.requestAnimationFrame(() => {
      editorRootRef.current?.parentElement?.scrollTo({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        top: 0,
      });
    });
  }

  function selectAdjacentEditorTab(event: KeyboardEvent<HTMLButtonElement>, key: ParticipantEditorTab) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") {
      return;
    }

    event.preventDefault();
    const currentIndex = editorTabs.findIndex((item) => item.key === key);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? editorTabs.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % editorTabs.length
            : (currentIndex - 1 + editorTabs.length) % editorTabs.length;
    const nextTab = editorTabs[nextIndex].key;
    selectEditorTab(nextTab);
    window.requestAnimationFrame(() => {
      document.getElementById(`participant-editor-tab-${user.id}-${nextTab}`)?.focus();
    });
  }

  return (
    <div ref={editorRootRef} className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6">
      <div
        aria-label={`${user.name} editor sections`}
        className="sticky top-0 z-10 grid grid-cols-3 gap-1 border-b border-black/5 bg-cream/95 px-4 py-3 backdrop-blur sm:px-6"
        role="tablist"
      >
        {editorTabs.map((item) => (
          <button
            aria-controls={`participant-editor-panel-${user.id}-${item.key}`}
            aria-selected={editorTab === item.key}
            className={`min-h-11 rounded-full px-3 py-2 text-sm font-semibold transition ${
              editorTab === item.key
                ? "bg-moss text-white shadow-[0_8px_18px_rgba(77,139,91,0.18)]"
                : "text-ink/70 hover:bg-sand/70 hover:text-ink"
            }`}
            id={`participant-editor-tab-${user.id}-${item.key}`}
            key={item.key}
            onClick={() => selectEditorTab(item.key)}
            onKeyDown={(event) => selectAdjacentEditorTab(event, item.key)}
            role="tab"
            tabIndex={editorTab === item.key ? 0 : -1}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-6">
        {editorTab === "overview" ? (
          <div
            aria-labelledby={`participant-editor-tab-${user.id}-overview`}
            className="space-y-4"
            id={`participant-editor-panel-${user.id}-overview`}
            role="tabpanel"
            tabIndex={0}
          >
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <SummaryTile
                detail={
                  user.isPrivate
                    ? `${user.progressPct}% overall progress`
                    : user.heightCm !== null
                      ? `${user.heightCm} cm height saved`
                      : "Height optional"
                }
                label={currentLabel}
                value={currentValue}
              />
              <SummaryTile
                detail={user.isPrivate ? "Raw weights remain hidden" : `${formatWeight(user.totalKgLost)} lost so far`}
                label={targetLabel}
                value={targetValue}
              />
              <SummaryTile
                detail={`${formatRm(user.monthlyPenaltyRm)} if missed`}
                label="Monthly rule"
                value={`${formatWeight(user.monthlyLossTargetKg)} target`}
              />
              <SummaryTile
                detail={user.needsStartingWeight ? "Starting weight still needed" : "Ready for tracking"}
                label="Challenge start"
                value={challengeStartLabel}
              />
            </div>

            {user.claimCode && !user.hasLoginAccess ? (
              <EditorSection
                description="Share this code when the participant is ready to claim the profile."
                title="Claim code"
              >
                <CopyValueField buttonLabel="Copy code" value={user.claimCode} />
              </EditorSection>
            ) : null}

            <EditorSection
              description={
                user.isPrivate
                  ? "Private profiles use loss targets and keep raw weight hidden."
                  : "Public profiles use visible start and target weights."
              }
              title="Tracking profile"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingBlock label="Height (cm)">
                  <form action={updateHeightAction} className="flex flex-col gap-2 sm:flex-row">
                    <input name="userId" type="hidden" value={user.id} />
                    <input
                      aria-label="Height in centimetres"
                      className="field min-w-0"
                      defaultValue={user.heightCm ?? undefined}
                      max="250"
                      min="50"
                      name="heightCm"
                      placeholder="Optional"
                      step="0.01"
                      type="number"
                    />
                    <button className="secondary-button min-h-11 w-full px-4 py-2 sm:w-auto" type="submit">
                      Save height
                    </button>
                  </form>
                </SettingBlock>

                {!user.isPrivate ? (
                  <SettingBlock label="Start weight (kg)">
                    <form action={updateStartWeightAction} className="flex flex-col gap-2 sm:flex-row">
                      <input name="userId" type="hidden" value={user.id} />
                      <input
                        aria-label="Starting weight in kilograms"
                        className="field min-w-0"
                        defaultValue={user.startWeight ?? undefined}
                        min="1"
                        name="startWeight"
                        required
                        step="0.01"
                        type="number"
                      />
                      <button className="secondary-button min-h-11 w-full px-4 py-2 sm:w-auto" type="submit">
                        Save start
                      </button>
                    </form>
                  </SettingBlock>
                ) : null}

                {user.isPrivate ? (
                  <SettingBlock label="Target loss (kg)">
                    <form action={updateTargetLossAction} className="flex flex-col gap-2 sm:flex-row">
                      <input name="userId" type="hidden" value={user.id} />
                      <input
                        aria-label="Target loss in kilograms"
                        className="field min-w-0"
                        defaultValue={user.targetLossKg ?? undefined}
                        min="0.01"
                        name="targetLossKg"
                        required
                        step="0.01"
                        type="number"
                      />
                      <button className="secondary-button min-h-11 w-full px-4 py-2 sm:w-auto" type="submit">
                        Save target
                      </button>
                    </form>
                  </SettingBlock>
                ) : (
                  <SettingBlock label="Target weight (kg)">
                    <form action={updateTargetWeightAction} className="flex flex-col gap-2 sm:flex-row">
                      <input name="userId" type="hidden" value={user.id} />
                      <input
                        aria-label="Target weight in kilograms"
                        className="field min-w-0"
                        defaultValue={user.targetWeight ?? undefined}
                        min="1"
                        name="targetWeight"
                        required
                        step="0.01"
                        type="number"
                      />
                      <button className="secondary-button min-h-11 w-full px-4 py-2 sm:w-auto" type="submit">
                        Save target
                      </button>
                    </form>
                  </SettingBlock>
                )}
              </div>

              {user.isPrivate ? (
                <div className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-ink/70">
                  {user.needsStartingWeight
                    ? "The participant still needs to add a private starting weight after claim."
                    : "Private starting weight has already been supplied by the participant."}
                </div>
              ) : null}
            </EditorSection>

            <EditorSection
              description="Privacy stays admin-controlled only until the participant has claimed the account."
              title="Access and visibility"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingBlock label="Privacy mode">
                  {user.adminCanTogglePrivacy ? (
                    <form action={updateAdminPrivacyModeAction} className="flex flex-col gap-2 sm:flex-row">
                      <input name="userId" type="hidden" value={user.id} />
                      <select
                        aria-label="Privacy mode"
                        className="field min-w-0"
                        defaultValue={user.isPrivate ? "private" : "public"}
                        name="privacyMode"
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                      <button className="secondary-button min-h-11 w-full px-4 py-2 sm:w-auto" type="submit">
                        Save privacy
                      </button>
                    </form>
                  ) : (
                    <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink/70">
                      <p className="font-semibold text-ink">{user.isPrivate ? "Private" : "Public"}</p>
                      <p className="mt-1">Participant controls this after claim.</p>
                    </div>
                  )}
                </SettingBlock>

                <SettingBlock label="Role">
                  <form action={updateUserRoleAction} className="flex flex-col gap-2 sm:flex-row">
                    <input name="userId" type="hidden" value={user.id} />
                    <select
                      aria-label="Account role"
                      className="field min-w-0"
                      defaultValue={String(user.isAdmin)}
                      name="isAdmin"
                    >
                      <option value="false">Member</option>
                      <option value="true">Admin</option>
                    </select>
                    <button className="secondary-button min-h-11 w-full px-4 py-2 sm:w-auto" type="submit">
                      Save role
                    </button>
                  </form>
                </SettingBlock>
              </div>
            </EditorSection>

            <EditorSection
              description="Deleting a profile also removes every saved entry and monthly result for that user."
              title="Danger zone"
              tone="danger"
            >
              <DeleteUserForm
                disabled={user.id === sessionUserId || (user.isAdmin && adminCount <= 1)}
                disabledReason={
                  user.id === sessionUserId
                    ? "You cannot remove your own profile."
                    : user.isAdmin && adminCount <= 1
                      ? "Keep at least one admin profile."
                      : undefined
                }
                userId={user.id}
                userName={user.name}
              />
            </EditorSection>
          </div>
        ) : null}

        {editorTab === "targets" ? (
          <div
            aria-labelledby={`participant-editor-tab-${user.id}-targets`}
            className="space-y-4"
            id={`participant-editor-panel-${user.id}-targets`}
            role="tabpanel"
            tabIndex={0}
          >
            <EditorSection
              description="The missed-target penalty stays unchanged when a month target is discounted."
              title="Rules and penalties"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingBlock label="Monthly target (kg)">
                  <form action={updateMonthlyLossTargetAction} className="flex flex-col gap-2 sm:flex-row">
                    <input name="userId" type="hidden" value={user.id} />
                    <input
                      aria-label="Monthly loss target in kilograms"
                      className="field min-w-0"
                      defaultValue={user.monthlyLossTargetKg}
                      min="0.01"
                      name="monthlyLossTargetKg"
                      required
                      step="0.01"
                      type="number"
                    />
                    <button className="secondary-button min-h-11 w-full px-4 py-2 sm:w-auto" type="submit">
                      Save target
                    </button>
                  </form>
                </SettingBlock>

                <SettingBlock label="Penalty / month (RM)">
                  <form action={updateMonthlyPenaltyAction} className="flex flex-col gap-2 sm:flex-row">
                    <input name="userId" type="hidden" value={user.id} />
                    <input
                      aria-label="Monthly penalty in ringgit"
                      className="field min-w-0"
                      defaultValue={user.monthlyPenaltyRm}
                      min="0"
                      name="monthlyPenaltyRm"
                      required
                      step="1"
                      type="number"
                    />
                    <button className="secondary-button min-h-11 w-full px-4 py-2 sm:w-auto" type="submit">
                      Save penalty
                    </button>
                  </form>
                </SettingBlock>
              </div>

              <div className="mt-4">
                <SettingBlock label="Challenge start">
                  <form action={updateChallengeStartDateAction} className="flex flex-col gap-2 sm:flex-row">
                    <input name="userId" type="hidden" value={user.id} />
                    <input
                      aria-label="Challenge start date"
                      className="field w-full min-w-0 flex-1"
                      defaultValue={user.challengeStartDateIso ? formatDateInput(new Date(user.challengeStartDateIso)) : currentDateInputValue()}
                      name="challengeStartDate"
                      required
                      type="date"
                    />
                    <button className="secondary-button min-h-11 w-full px-4 py-2 sm:w-auto" type="submit">
                      Save date
                    </button>
                  </form>
                </SettingBlock>
              </div>
            </EditorSection>

            <PersonalMonthTargets monthPolicies={monthPolicies} user={user} />
          </div>
        ) : null}

        {editorTab === "history" ? (
          <div
            aria-labelledby={`participant-editor-tab-${user.id}-history`}
            id={`participant-editor-panel-${user.id}-history`}
            role="tabpanel"
            tabIndex={0}
          >
            <EditorSection
              description={
                user.isPrivate
                  ? "Admins add private progress changes here. Raw weights stay hidden."
                  : "Admins can add visible weigh-ins here."
              }
              title="History and backfill"
            >
              {user.isPrivate ? (
                <form action={createPrivateProgressEntryAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input name="userId" type="hidden" value={user.id} />
                  <label className="space-y-2 text-sm font-medium text-ink">
                    <span>Loss change (kg)</span>
                    <input className="field min-w-0" name="lossKg" required step="0.01" type="number" />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-ink">
                    <span>Date</span>
                    <input
                      className="field min-w-0"
                      defaultValue={currentDateInputValue()}
                      name="date"
                      required
                      type="date"
                    />
                  </label>
                  <PendingSubmitButton
                    className="primary-button min-h-11 w-full md:self-end md:w-auto"
                    pendingLabel="Adding update…"
                  >
                    Add update
                  </PendingSubmitButton>
                </form>
              ) : (
                <form action={createWeightEntryAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <input name="userId" type="hidden" value={user.id} />
                  <label className="space-y-2 text-sm font-medium text-ink">
                    <span>Weight (kg)</span>
                    <input className="field min-w-0" min="1" name="weight" required step="0.01" type="number" />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-ink">
                    <span>Date</span>
                    <input
                      className="field min-w-0"
                      defaultValue={currentDateInputValue()}
                      name="date"
                      required
                      type="date"
                    />
                  </label>
                  <PendingSubmitButton
                    className="primary-button min-h-11 w-full md:self-end md:w-auto"
                    pendingLabel="Adding entry…"
                  >
                    Add entry
                  </PendingSubmitButton>
                </form>
              )}

              <div className="mt-5 space-y-3">
                {entries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/70">
                    No history for this participant yet.
                  </div>
                ) : (
                  entries.map((entry) => <EntryEditor entry={entry} key={entry.id} />)
                )}
              </div>
            </EditorSection>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AdminOnlyEditor({
  adminCount,
  sessionUserId,
  user,
}: {
  adminCount: number;
  sessionUserId: string;
  user: AdminUserSummary;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryTile detail="Role can still be changed" label="Access" value={user.isAdmin ? "Admin" : "Member"} />
        <SummaryTile detail="This account does not join tracking" label="Mode" value="Admin-only" />
        <SummaryTile detail={user.email ?? "No email linked"} label="Email" value={user.name} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
        <EditorSection
          description="This account can manage the app without joining the tracked participant roster."
          title="Role"
        >
          <form action={updateUserRoleAction} className="flex max-w-sm flex-col gap-2 sm:flex-row">
            <input name="userId" type="hidden" value={user.id} />
            <select aria-label="Account role" className="field min-w-0" defaultValue={String(user.isAdmin)} name="isAdmin">
              <option value="false">Member</option>
              <option value="true">Admin</option>
            </select>
            <button className="secondary-button min-h-11 w-full px-4 py-2 sm:w-auto" type="submit">
              Save role
            </button>
          </form>
        </EditorSection>

        <EditorSection
          description="Delete this access-only account if it is no longer needed."
          title="Danger zone"
          tone="danger"
        >
          <DeleteUserForm
            disabled={user.id === sessionUserId || (user.isAdmin && adminCount <= 1)}
            disabledReason={
              user.id === sessionUserId
                ? "You cannot remove your own profile."
                : user.isAdmin && adminCount <= 1
                  ? "Keep at least one admin profile."
                  : undefined
            }
            userId={user.id}
            userName={user.name}
          />
        </EditorSection>
      </div>
    </div>
  );
}

function ParticipantEmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center text-sm text-ink/70">
      {message}
    </div>
  );
}

export function AdminWorkspace({
  entries,
  monthPolicies,
  sessionUserId,
  users,
}: AdminWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<WorkspaceTab>("participants");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [shouldRefreshOnCreateClose, setShouldRefreshOnCreateClose] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const workspaceTabListRef = useRef<HTMLDivElement>(null);

  const participants = users.filter((user) => user.isParticipant);
  const pendingParticipants = participants.filter((user) => !user.hasLoginAccess);
  const activeParticipants = participants.filter((user) => user.hasLoginAccess);
  const privateParticipants = participants.filter((user) => user.isPrivate);
  const publicParticipants = participants.filter((user) => !user.isPrivate);
  const adminOnlyUsers = users.filter((user) => !user.isParticipant);
  const adminCount = users.filter((user) => user.isAdmin).length;
  const totalRmOwed = participants.reduce((sum, user) => sum + user.totalRmOwed, 0);
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
  const selectedEntries = selectedUserId ? entries.filter((entry) => entry.userId === selectedUserId) : [];
  const workspaceTabs: Array<{ key: WorkspaceTab; label: string; count: number }> = [
    { key: "participants", label: "People", count: activeParticipants.length + adminOnlyUsers.length },
    { key: "claims", label: "Claims", count: pendingParticipants.length },
    { key: "settings", label: "Rules", count: monthPolicies.length },
  ];

  useEffect(() => {
    if (selectedUserId && !selectedUser) {
      setSelectedUserId(null);
    }
  }, [selectedUser, selectedUserId]);

  function handleCreateSheetClose() {
    setIsCreateOpen(false);

    if (shouldRefreshOnCreateClose) {
      setShouldRefreshOnCreateClose(false);
      router.refresh();
    }
  }

  function selectWorkspaceTab(nextTab: WorkspaceTab) {
    setTab(nextTab);
    window.requestAnimationFrame(() => {
      workspaceTabListRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  function selectAdjacentWorkspaceTab(event: KeyboardEvent<HTMLButtonElement>, key: WorkspaceTab) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") {
      return;
    }

    event.preventDefault();
    const currentIndex = workspaceTabs.findIndex((item) => item.key === key);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? workspaceTabs.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % workspaceTabs.length
            : (currentIndex - 1 + workspaceTabs.length) % workspaceTabs.length;
    const nextTab = workspaceTabs[nextIndex].key;
    selectWorkspaceTab(nextTab);
    window.requestAnimationFrame(() => {
      document.getElementById(`admin-workspace-tab-${nextTab}`)?.focus();
    });
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-4 pb-28 sm:px-6 sm:py-8">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Admin</p>
          <h1 className="mt-1 text-2xl font-semibold [font-family:var(--font-heading)] text-ink sm:text-3xl">Club workspace</h1>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-ink/70">
            Manage people, claims, and monthly rules.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            className="primary-button flex min-h-11 items-center justify-center gap-2 px-4"
            onClick={() => setIsCreateOpen(true)}
            type="button"
          >
            <Plus aria-hidden="true" size={18} weight="bold" />
            Add participant
          </button>
          <Link className="secondary-button flex min-h-11 items-center justify-center gap-1 px-4" href="/dashboard">
            Dashboard
            <CaretRight aria-hidden="true" size={16} weight="bold" />
          </Link>
        </div>
      </div>

      <section
        aria-label="Workspace summary"
        className="mb-5 grid grid-cols-2 gap-2 rounded-[24px] border border-black/5 bg-sand/35 p-2 sm:gap-3 sm:p-3 xl:grid-cols-4"
      >
        <SummaryTile
          detail={`${activeParticipants.length} active, ${pendingParticipants.length} waiting to claim`}
          label="Participants"
          value={participants.length}
        />
        <SummaryTile
          detail={`${privateParticipants.length} private, ${publicParticipants.length} public`}
          label="Roster mix"
          value={`${publicParticipants.length}/${privateParticipants.length}`}
        />
        <SummaryTile
          detail="Access-only accounts stay outside the tracked roster"
          label="Admin-only"
          value={adminOnlyUsers.length}
        />
        <SummaryTile
          detail="Combined amount across every tracked participant"
          label="Total RM owed"
          value={formatRm(totalRmOwed)}
        />
      </section>

      <div
        ref={workspaceTabListRef}
        aria-label="Admin workspace sections"
        className="sticky top-2 z-20 mb-5 grid w-full grid-cols-3 gap-1 rounded-[22px] border border-black/5 bg-cream/90 p-1.5 shadow-[0_10px_30px_rgba(31,42,31,0.08)] backdrop-blur sm:static sm:w-auto sm:max-w-lg"
        role="tablist"
      >
        {workspaceTabs.map((item) => (
          <button
            aria-controls={`admin-workspace-panel-${item.key}`}
            aria-selected={tab === item.key}
            id={`admin-workspace-tab-${item.key}`}
            key={item.key}
            className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition ${
              tab === item.key
                ? "bg-moss text-white shadow-[0_10px_24px_rgba(77,139,91,0.2)]"
                : "text-ink/70 hover:bg-sand/70 hover:text-ink"
            }`}
            onClick={() => selectWorkspaceTab(item.key)}
            onKeyDown={(event) => selectAdjacentWorkspaceTab(event, item.key)}
            role="tab"
            tabIndex={tab === item.key ? 0 : -1}
            type="button"
          >
            <span>{item.label}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${tab === item.key ? "bg-white/20 text-white" : "bg-white text-ink/70"}`}>
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "participants" ? (
        <div
          aria-labelledby="admin-workspace-tab-participants"
          className="space-y-5"
          id="admin-workspace-panel-participants"
          role="tabpanel"
          tabIndex={0}
        >
          <WorkspaceSection
            action={<span className="status-chip bg-white text-ink/70">{activeParticipants.length} roster profiles</span>}
            description="Claimed participants stay compact here. Open a sheet only when you need to edit rules, privacy, or history."
            title="Participants"
          >
            {activeParticipants.length === 0 ? (
              <ParticipantEmptyState message="No active participant profiles yet." />
            ) : (
              <div className="space-y-3">
                {activeParticipants.map((user) => (
                  <ParticipantRow key={user.id} onManage={() => setSelectedUserId(user.id)} user={user} />
                ))}
              </div>
            )}
          </WorkspaceSection>

          <WorkspaceSection
            action={<span className="status-chip bg-white text-ink/70">{adminOnlyUsers.length} access profiles</span>}
            description="Management-only accounts live separately from the tracked roster."
            title="Admin-only access"
          >
            {adminOnlyUsers.length === 0 ? (
              <ParticipantEmptyState message="No admin-only access profiles right now." />
            ) : (
              <div className="space-y-3">
                {adminOnlyUsers.map((user) => (
                  <AdminAccessRow key={user.id} onManage={() => setSelectedUserId(user.id)} user={user} />
                ))}
              </div>
            )}
          </WorkspaceSection>
        </div>
      ) : null}

      {tab === "claims" ? (
        <div
          aria-labelledby="admin-workspace-tab-claims"
          id="admin-workspace-panel-claims"
          role="tabpanel"
          tabIndex={0}
        >
          <WorkspaceSection
            action={<span className="status-chip bg-white text-ink/70">{pendingParticipants.length} pending claims</span>}
            description="Profiles waiting to be claimed stay in their own queue so roster management stays cleaner."
            title="Claim queue"
          >
            {pendingParticipants.length === 0 ? (
              <ParticipantEmptyState message="No pending claim profiles right now." />
            ) : (
              <div className="space-y-3">
                {pendingParticipants.map((user) => (
                  <ClaimRow key={user.id} onManage={() => setSelectedUserId(user.id)} user={user} />
                ))}
              </div>
            )}
          </WorkspaceSection>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div
          aria-labelledby="admin-workspace-tab-settings"
          className="space-y-5"
          id="admin-workspace-panel-settings"
          role="tabpanel"
          tabIndex={0}
        >
          <WorkspaceSection
            action={<span className="status-chip bg-white text-ink/70">{monthPolicies.length} active overrides</span>}
            description="Group-wide month rules live here. Participant-specific targets and penalties stay inside each participant editor."
            title="Month rules"
          >
            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <EditorSection
                description="Saving 100% removes the override and returns that month to normal rules."
                title="Add or update a month rule"
              >
                <form action={upsertMonthPolicyAction} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                  <label className="block space-y-2 text-sm font-medium text-ink">
                    <span>Month</span>
                    <input className="field" defaultValue={currentMonthInputValue()} name="month" required type="month" />
                  </label>

                  <label className="block space-y-2 text-sm font-medium text-ink">
                    <span>Required % of target</span>
                    <input
                      className="field"
                      defaultValue={75}
                      max="200"
                      min="1"
                      name="requiredTargetPct"
                      required
                      step="1"
                      type="number"
                    />
                  </label>

                  <div className="flex items-end">
                    <button className="primary-button min-h-11 w-full md:w-auto" type="submit">
                      Save rule
                    </button>
                  </div>
                </form>
              </EditorSection>

              <EditorSection
                description="Removing a rule immediately returns that calendar month to the normal target percentage."
                title="Danger zone"
                tone="danger"
              >
                {monthPolicies.length === 0 ? (
                  <ParticipantEmptyState message="No special month rules yet." />
                ) : (
                  <div className="space-y-3">
                    {monthPolicies.map((policy) => (
                      <div
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6c8c0] bg-white/80 px-4 py-3"
                        key={policy.id}
                      >
                        <div>
                          <p className="font-semibold text-ink">{getMonthLabel(policy.month, policy.year)}</p>
                          <p className="mt-1 text-sm text-ink/70">{policy.requiredTargetPct}% of each participant&apos;s monthly target</p>
                        </div>

                        <form action={deleteMonthPolicyAction}>
                          <input name="policyId" type="hidden" value={policy.id} />
                            <button
                              aria-label={`Remove group rule for ${getMonthLabel(policy.month, policy.year)}`}
                              className="secondary-button min-h-11 px-4 py-2"
                              type="submit"
                            >
                            Remove
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </EditorSection>
            </div>
          </WorkspaceSection>
        </div>
      ) : null}

      <AdminSheet
        closeLabel="Close add participant"
        description="Create a participant profile now, then share the claim code whenever they should activate it."
        onClose={handleCreateSheetClose}
        open={isCreateOpen}
        title="Add participant"
      >
        <CreateParticipantForm
          onClose={handleCreateSheetClose}
          onCreated={() => setShouldRefreshOnCreateClose(true)}
          variant="embedded"
        />
      </AdminSheet>

      <AdminSheet
        closeLabel={selectedUser?.isParticipant ? "Close participant editor" : "Close account editor"}
        description={
          selectedUser
            ? selectedUser.isParticipant
              ? "Manage profile rules, privacy, history, and claim flow without leaving the workspace."
              : "This account can manage the app without joining the tracked participant roster."
            : undefined
        }
        onClose={() => setSelectedUserId(null)}
        open={selectedUser !== null}
        title={selectedUser ? selectedUser.name : "Profile editor"}
      >
        {selectedUser ? (
          selectedUser.isParticipant ? (
            <ParticipantEditor
              adminCount={adminCount}
              entries={selectedEntries}
              key={selectedUser.id}
              monthPolicies={monthPolicies}
              sessionUserId={sessionUserId}
              user={selectedUser}
            />
          ) : (
            <AdminOnlyEditor
              adminCount={adminCount}
              sessionUserId={sessionUserId}
              user={selectedUser}
            />
          )
        ) : null}
      </AdminSheet>
    </main>
  );
}
