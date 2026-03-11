"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { AdminSheet } from "@/components/admin/admin-sheet";
import { CopyValueField } from "@/components/copy-value-field";
import { CreateParticipantForm } from "@/components/create-participant-form";
import { DeleteWeightEntryForm } from "@/components/delete-weight-entry-form";
import { DeleteUserForm } from "@/components/delete-user-form";
import {
  createPrivateProgressEntryAction,
  createWeightEntryAction,
  deleteMonthPolicyAction,
  upsertMonthPolicyAction,
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
    <div className="panel p-4 sm:p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold [font-family:var(--font-heading)] text-ink sm:text-3xl">{value}</p>
      <p className="mt-1 text-sm text-ink/60">{detail}</p>
    </div>
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
    <section className="panel p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold [font-family:var(--font-heading)] text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink/65">{description}</p>
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
      ? "rounded-[24px] border border-[#e6c8c0] bg-[#fff5f2] p-4"
      : "panel-muted p-4";

  return (
    <section className={className}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-ink/60">{description}</p>
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
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">{label}</p>
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
  items,
}: {
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
      <summary className="secondary-button flex h-10 w-10 list-none items-center justify-center px-0 py-0 text-base [&::-webkit-details-marker]:hidden">
        ...
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
    <div className="rounded-2xl bg-white/80 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink/55">{detail}</p>
    </div>
  );
}

function ParticipantSummaryRow({
  children,
  chips,
  description,
  label,
  metrics,
  onManage,
}: {
  children?: ReactNode;
  chips: ReactNode;
  description: string;
  label: ReactNode;
  metrics: Array<{ detail: string; label: string; value: string }>;
  onManage: () => void;
}) {
  return (
    <article className="rounded-[28px] border border-black/8 bg-white/85 p-4 shadow-[0_12px_32px_rgba(31,42,31,0.06)]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">{chips}</div>
          <div className="mt-3 min-w-0">
            {label}
            <p className="mt-2 text-sm text-ink/60">{description}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {metrics.map((metric) => (
            <RosterMetric
              key={metric.label}
              detail={metric.detail}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button className="secondary-button px-4 py-2" onClick={onManage} type="button">
            Manage
          </button>
          {children}
        </div>
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
          {user.isAdmin ? <StatusChip className="bg-white text-ink/60" label="Admin access" /> : null}
        </>
      }
      description={user.email ?? "No email linked yet"}
      label={<h3 className="truncate text-xl font-semibold [font-family:var(--font-heading)] text-ink">{user.name}</h3>}
      metrics={[
        { label: currentLabel, value: currentValue, detail: currentDetail },
        { label: targetLabel, value: targetValue, detail: targetDetail },
        { label: "Rules", value: rulesValue, detail: rulesDetail },
      ]}
      onManage={onManage}
    >
      <ActionMenu
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
          {user.isAdmin ? <StatusChip className="bg-white text-ink/60" label="Admin" /> : null}
        </>
      }
      description={user.email ?? "No email linked yet"}
      label={<h3 className="truncate text-xl font-semibold [font-family:var(--font-heading)] text-ink">{user.name}</h3>}
      metrics={[
        { label: "Access", value: user.isAdmin ? "Admin" : "Member", detail: "Role can still be changed" },
        { label: "Tracking", value: "Excluded", detail: "No leaderboards or penalties" },
        { label: "Status", value: "Workspace only", detail: "Management account" },
      ]}
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
          <StatusChip className="bg-white text-ink/60" label={user.isPrivate ? "Private profile" : "Public profile"} />
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
      onManage={onManage}
    >
      <ActionMenu
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
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink/45">
            {entry.entryType === "ABSOLUTE" ? "Weight entry" : entry.userIsPrivate ? "Private change" : "Change log"}
          </p>
        </div>

        <div className="text-right">
          {entry.userIsPrivate ? (
            <>
              <p className="font-semibold text-ink">{formatWeight(entry.totalKgLost)} total lost</p>
              <p className="mt-1 text-xs text-ink/55">{entry.lossKg !== null ? formatLossDelta(entry.lossKg) : "Private"}</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-ink">
                {entry.visibleWeight !== null ? formatWeight(entry.visibleWeight) : "Not available"}
              </p>
              {entry.entryType === "LOSS_DELTA" && entry.lossKg !== null ? (
                <p className="mt-1 text-xs text-ink/55">{formatLossDelta(entry.lossKg)}</p>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="mt-4">
        {entry.entryType === "ABSOLUTE" ? (
          <form action={updateWeightEntryAction} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input name="entryId" type="hidden" value={entry.id} />
            <input name="userId" type="hidden" value={entry.userId} />
            <input
              aria-label="Weight"
              className="field min-w-0"
              defaultValue={entry.weight ?? undefined}
              min="1"
              name="weight"
              required
              step="0.01"
              type="number"
            />
            <input
              aria-label="Date"
              className="field min-w-0"
              defaultValue={formatDateInput(new Date(entry.isoDate))}
              name="date"
              required
              type="date"
            />
            <button className="secondary-button px-4 py-2" type="submit">
              Save
            </button>
          </form>
        ) : (
          <form action={updatePrivateProgressEntryAction} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input name="entryId" type="hidden" value={entry.id} />
            <input name="userId" type="hidden" value={entry.userId} />
            <input
              aria-label="Change"
              className="field min-w-0"
              defaultValue={entry.lossKg ?? undefined}
              name="lossKg"
              required
              step="0.01"
              type="number"
            />
            <input
              aria-label="Date"
              className="field min-w-0"
              defaultValue={formatDateInput(new Date(entry.isoDate))}
              name="date"
              required
              type="date"
            />
            <button className="secondary-button px-4 py-2" type="submit">
              Save
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

function ParticipantEditor({
  adminCount,
  entries,
  sessionUserId,
  user,
}: {
  adminCount: number;
  entries: AdminEntrySummary[];
  sessionUserId: string;
  user: AdminUserSummary;
}) {
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

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          detail={user.needsStartingWeight ? "Starting weight still needed" : "Ready for normal tracking"}
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

      <div className="grid gap-4 xl:grid-cols-2">
        <EditorSection
          description="Penalty, target, and official challenge start stay here."
          title="Rules and penalties"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingBlock label="Monthly target">
              <form action={updateMonthlyLossTargetAction} className="flex flex-col gap-2 sm:flex-row">
                <input name="userId" type="hidden" value={user.id} />
                <input
                  className="field min-w-0"
                  defaultValue={user.monthlyLossTargetKg}
                  min="0.01"
                  name="monthlyLossTargetKg"
                  required
                  step="0.01"
                  type="number"
                />
                <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                  Save
                </button>
              </form>
            </SettingBlock>

            <SettingBlock label="Penalty / month">
              <form action={updateMonthlyPenaltyAction} className="flex flex-col gap-2 sm:flex-row">
                <input name="userId" type="hidden" value={user.id} />
                <input
                  className="field min-w-0"
                  defaultValue={user.monthlyPenaltyRm}
                  min="0"
                  name="monthlyPenaltyRm"
                  required
                  step="1"
                  type="number"
                />
                <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                  Save
                </button>
              </form>
            </SettingBlock>
          </div>

          <div className="mt-3">
            <SettingBlock label="Challenge start">
              <form action={updateChallengeStartDateAction} className="flex flex-col gap-2 sm:flex-row">
                <input name="userId" type="hidden" value={user.id} />
                <input
                  className="field w-full min-w-0 flex-1"
                  defaultValue={user.challengeStartDateIso ? formatDateInput(new Date(user.challengeStartDateIso)) : currentDateInputValue()}
                  name="challengeStartDate"
                  required
                  type="date"
                />
                <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                  Save
                </button>
              </form>
            </SettingBlock>
          </div>
        </EditorSection>

        <EditorSection
          description={
            user.isPrivate
              ? "Private profiles use loss targets and keep raw weight hidden."
              : "Public profiles use visible start and target weights."
          }
          title="Tracking profile"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingBlock label="Height (cm)">
              <form action={updateHeightAction} className="flex flex-col gap-2 sm:flex-row">
                <input name="userId" type="hidden" value={user.id} />
                <input
                  className="field min-w-0"
                  defaultValue={user.heightCm ?? undefined}
                  max="250"
                  min="50"
                  name="heightCm"
                  placeholder="Optional"
                  step="0.01"
                  type="number"
                />
                <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                  Save
                </button>
              </form>
            </SettingBlock>

            {!user.isPrivate ? (
              <SettingBlock label="Start weight">
                <form action={updateStartWeightAction} className="flex flex-col gap-2 sm:flex-row">
                  <input name="userId" type="hidden" value={user.id} />
                  <input
                    className="field min-w-0"
                    defaultValue={user.startWeight ?? undefined}
                    min="1"
                    name="startWeight"
                    required
                    step="0.01"
                    type="number"
                  />
                  <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                    Save
                  </button>
                </form>
              </SettingBlock>
            ) : null}

            {user.isPrivate ? (
              <SettingBlock label="Target loss">
                <form action={updateTargetLossAction} className="flex flex-col gap-2 sm:flex-row">
                  <input name="userId" type="hidden" value={user.id} />
                  <input
                    className="field min-w-0"
                    defaultValue={user.targetLossKg ?? undefined}
                    min="0.01"
                    name="targetLossKg"
                    required
                    step="0.01"
                    type="number"
                  />
                  <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                    Save
                  </button>
                </form>
              </SettingBlock>
            ) : (
              <SettingBlock label="Target weight">
                <form action={updateTargetWeightAction} className="flex flex-col gap-2 sm:flex-row">
                  <input name="userId" type="hidden" value={user.id} />
                  <input
                    className="field min-w-0"
                    defaultValue={user.targetWeight ?? undefined}
                    min="1"
                    name="targetWeight"
                    required
                    step="0.01"
                    type="number"
                  />
                  <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                    Save
                  </button>
                </form>
              </SettingBlock>
            )}
          </div>

          {user.isPrivate ? (
            <div className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-ink/60">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingBlock label="Privacy mode">
              {user.adminCanTogglePrivacy ? (
                <form action={updateAdminPrivacyModeAction} className="flex flex-col gap-2 sm:flex-row">
                  <input name="userId" type="hidden" value={user.id} />
                  <select className="field min-w-0" defaultValue={user.isPrivate ? "private" : "public"} name="privacyMode">
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                  <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                    Save
                  </button>
                </form>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink/65">
                  <p className="font-semibold text-ink">{user.isPrivate ? "Private" : "Public"}</p>
                  <p className="mt-1">Participant controls this after claim.</p>
                </div>
              )}
            </SettingBlock>

            <SettingBlock label="Role">
              <form action={updateUserRoleAction} className="flex flex-col gap-2 sm:flex-row">
                <input name="userId" type="hidden" value={user.id} />
                <select className="field min-w-0" defaultValue={String(user.isAdmin)} name="isAdmin">
                  <option value="false">Member</option>
                  <option value="true">Admin</option>
                </select>
                <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                  Save
                </button>
              </form>
            </SettingBlock>
          </div>
        </EditorSection>

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
              <input
                className="field min-w-0"
                name="lossKg"
                placeholder="Change"
                required
                step="0.01"
                type="number"
              />
              <input
                className="field min-w-0"
                defaultValue={currentDateInputValue()}
                name="date"
                required
                type="date"
              />
              <button className="primary-button w-full md:w-auto" type="submit">
                Add update
              </button>
            </form>
          ) : (
            <form action={createWeightEntryAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input name="userId" type="hidden" value={user.id} />
              <input
                className="field min-w-0"
                min="1"
                name="weight"
                placeholder="Weight"
                required
                step="0.01"
                type="number"
              />
              <input
                className="field min-w-0"
                defaultValue={currentDateInputValue()}
                name="date"
                required
                type="date"
              />
              <button className="primary-button w-full md:w-auto" type="submit">
                Add entry
              </button>
            </form>
          )}

          <div className="mt-4 space-y-3">
            {entries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/60">
                No history for this participant yet.
              </div>
            ) : (
              <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-1">
                {entries.map((entry) => (
                  <EntryEditor entry={entry} key={entry.id} />
                ))}
              </div>
            )}
          </div>
        </EditorSection>
      </div>

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
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
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
            <select className="field min-w-0" defaultValue={String(user.isAdmin)} name="isAdmin">
              <option value="false">Member</option>
              <option value="true">Admin</option>
            </select>
            <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
              Save
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
    <div className="rounded-2xl border border-dashed border-black/10 px-4 py-10 text-center text-sm text-ink/60">
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

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold [font-family:var(--font-heading)] text-ink">Club workspace</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink/70">
            One place for roster management, claim review, and group-wide rule changes.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="primary-button" onClick={() => setIsCreateOpen(true)} type="button">
            Add participant
          </button>
          <Link className="secondary-button" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="mb-6 inline-flex w-full flex-wrap gap-2 rounded-[28px] border border-black/5 bg-white/70 p-2 shadow-[0_10px_30px_rgba(31,42,31,0.04)] sm:w-auto">
        {[
          { key: "participants", label: "Participants", count: activeParticipants.length + adminOnlyUsers.length },
          { key: "claims", label: "Claims", count: pendingParticipants.length },
          { key: "settings", label: "Settings", count: monthPolicies.length },
        ].map((item) => (
          <button
            key={item.key}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === item.key
                ? "bg-moss text-white shadow-[0_10px_24px_rgba(77,139,91,0.2)]"
                : "text-ink/70 hover:bg-sand/70 hover:text-ink"
            }`}
            onClick={() => setTab(item.key as WorkspaceTab)}
            type="button"
          >
            <span>{item.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${tab === item.key ? "bg-white/20 text-white" : "bg-white text-ink/55"}`}>
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {tab === "participants" ? (
        <div className="space-y-6">
          <WorkspaceSection
            action={<span className="status-chip bg-white text-ink/60">{activeParticipants.length} roster profiles</span>}
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
            action={<span className="status-chip bg-white text-ink/60">{adminOnlyUsers.length} access profiles</span>}
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
        <WorkspaceSection
          action={<span className="status-chip bg-white text-ink/60">{pendingParticipants.length} pending claims</span>}
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
      ) : null}

      {tab === "settings" ? (
        <div className="space-y-6">
          <WorkspaceSection
            action={<span className="status-chip bg-white text-ink/60">{monthPolicies.length} active overrides</span>}
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
                    <button className="primary-button w-full md:w-auto" type="submit">
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
                          <p className="mt-1 text-sm text-ink/60">{policy.requiredTargetPct}% of each participant&apos;s monthly target</p>
                        </div>

                        <form action={deleteMonthPolicyAction}>
                          <input name="policyId" type="hidden" value={policy.id} />
                          <button className="secondary-button px-4 py-2" type="submit">
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
