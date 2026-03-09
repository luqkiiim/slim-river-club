import Link from "next/link";
import type { ReactNode } from "react";

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
import { getAdminPayload } from "@/lib/data";
import { requireAdminSession } from "@/lib/session";
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
import type { AdminUserSummary } from "@/types/app";

function OverviewCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="panel p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">{label}</p>
      <p className="mt-3 text-3xl font-semibold [font-family:var(--font-heading)]">{value}</p>
      <p className="mt-2 text-sm text-ink/60">{detail}</p>
    </div>
  );
}

function SectionPanel({
  title,
  description,
  children,
  tone = "default",
}: {
  title: string;
  description: string;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  const classes =
    tone === "danger"
      ? "rounded-[24px] border border-[#e6c8c0] bg-[#fff5f2] p-4"
      : "panel-muted p-4";

  return (
    <section className={classes}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-ink/60">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SettingForm({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
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

function ParticipantCard({
  user,
  sessionUserId,
  adminCount,
}: {
  user: AdminUserSummary;
  sessionUserId: string;
  adminCount: number;
}) {
  const currentLabel = user.isPrivate ? "Total lost" : "Current";
  const currentValue = user.isPrivate
    ? `${formatWeight(user.totalKgLost)} lost`
    : user.currentWeight !== null
      ? formatWeight(user.currentWeight)
      : "No entries yet";
  const currentDetail = user.isPrivate
    ? `${user.progressPct}% to target${user.needsStartingWeight ? " | starting weight pending" : ""}`
    : user.heightCm !== null
      ? `${user.heightCm} cm recorded for BMI`
      : "Height is optional";
  const targetValue = user.isPrivate
    ? user.targetLossKg !== null
      ? formatWeight(user.targetLossKg)
      : "Not set"
    : user.targetWeight !== null
      ? formatWeight(user.targetWeight)
      : "Not set";
  const targetLabel = user.isPrivate ? "Target loss" : "Target weight";
  const challengeStartLabel = user.challengeStartDateIso
    ? formatDate(new Date(user.challengeStartDateIso))
    : "Not set";

  return (
    <article className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold [font-family:var(--font-heading)]">{user.name}</h3>
            <span className={`status-chip ${getParticipantStateTone(user)}`}>{getParticipantState(user)}</span>
            <span className="status-chip bg-sand text-ink/75">{user.isPrivate ? "Private" : "Public"}</span>
            {user.isAdmin ? <span className="status-chip bg-white text-ink/65">Admin access</span> : null}
          </div>
          <p className="mt-2 text-sm text-ink/60">{user.email ?? "No email linked yet"}</p>
        </div>

        <div className="w-full rounded-3xl bg-sand/70 px-4 py-3 text-left sm:w-auto sm:text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Challenge start</p>
          <p className="mt-2 text-lg font-semibold text-ink">{challengeStartLabel}</p>
          <p className="mt-1 text-xs text-ink/55">
            {user.heightCm !== null ? `${user.heightCm} cm height on file` : "Height not recorded"}
          </p>
        </div>
      </div>

      {user.claimCode && !user.hasLoginAccess ? (
        <div className="mt-4 rounded-2xl border border-black/10 bg-sand/35 px-4 py-4">
          <p className="text-sm font-semibold text-ink">Claim code ready</p>
          <p className="mt-1 text-sm text-ink/60">
            Share this code when {user.name} should activate the account.
          </p>
          <CopyValueField value={user.claimCode} buttonLabel="Copy code" />
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="panel-muted p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">{currentLabel}</p>
          <p className="mt-2 font-semibold text-ink">{currentValue}</p>
          <p className="mt-1 text-xs text-ink/55">{currentDetail}</p>
        </div>
        <div className="panel-muted p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">{targetLabel}</p>
          <p className="mt-2 font-semibold text-ink">{targetValue}</p>
          <p className="mt-1 text-xs text-ink/55">
            {user.isPrivate ? "Raw weights stay hidden from other viewers." : `Lost ${formatWeight(user.totalKgLost)} so far`}
          </p>
        </div>
        <div className="panel-muted p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Monthly rule</p>
          <p className="mt-2 font-semibold text-ink">{formatWeight(user.monthlyLossTargetKg)} target</p>
          <p className="mt-1 text-xs text-ink/55">{formatRm(user.monthlyPenaltyRm)} if missed</p>
        </div>
        <div className="panel-muted p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">RM owed</p>
          <p className={`mt-2 font-semibold ${user.totalRmOwed > 0 ? "text-[#8f4a36]" : "text-moss"}`}>
            {formatRm(user.totalRmOwed)}
          </p>
          <p className="mt-1 text-xs text-ink/55">{user.progressPct}% overall progress</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <SectionPanel
          title="Monthly rules"
          description="Penalty, target, and official start date are managed here."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingForm label="Monthly target">
              <form action={updateMonthlyLossTargetAction} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="userId" value={user.id} />
                <input
                  className="field min-w-0"
                  name="monthlyLossTargetKg"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={user.monthlyLossTargetKg}
                  required
                />
                <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                  Save
                </button>
              </form>
            </SettingForm>

            <SettingForm label="Penalty / month">
              <form action={updateMonthlyPenaltyAction} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="userId" value={user.id} />
                <input
                  className="field min-w-0"
                  name="monthlyPenaltyRm"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={user.monthlyPenaltyRm}
                  required
                />
                <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                  Save
                </button>
              </form>
            </SettingForm>
          </div>

          <div className="mt-3">
            <SettingForm label="Challenge start">
              <form action={updateChallengeStartDateAction} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <input type="hidden" name="userId" value={user.id} />
                <input
                  className="field w-full min-w-0 flex-1"
                  name="challengeStartDate"
                  type="date"
                  defaultValue={user.challengeStartDateIso ? formatDateInput(new Date(user.challengeStartDateIso)) : currentDateInputValue()}
                  required
                />
                <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                  Save
                </button>
              </form>
            </SettingForm>
          </div>
        </SectionPanel>

        <SectionPanel
          title="Tracking profile"
          description={
            user.isPrivate
              ? "Private profiles use loss targets and keep the starting weight hidden."
              : "Public profiles use visible weights and can show BMI when height is present."
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingForm label="Height (cm)">
              <form action={updateHeightAction} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="userId" value={user.id} />
                <input
                  className="field min-w-0"
                  name="heightCm"
                  type="number"
                  step="0.01"
                  min="50"
                  max="250"
                  defaultValue={user.heightCm ?? undefined}
                  placeholder="Optional"
                />
                <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                  Save
                </button>
              </form>
            </SettingForm>

            {!user.isPrivate ? (
              <SettingForm label="Start weight">
                <form action={updateStartWeightAction} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="userId" value={user.id} />
                  <input
                    className="field min-w-0"
                    name="startWeight"
                    type="number"
                    step="0.01"
                    min="1"
                    defaultValue={user.startWeight ?? undefined}
                    required
                  />
                  <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                    Save
                  </button>
                </form>
              </SettingForm>
            ) : null}

            {user.isPrivate ? (
              <SettingForm label="Target loss">
                <form action={updateTargetLossAction} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="userId" value={user.id} />
                  <input
                    className="field min-w-0"
                    name="targetLossKg"
                    type="number"
                    step="0.01"
                    min="0.01"
                    defaultValue={user.targetLossKg ?? undefined}
                    required
                  />
                  <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                    Save
                  </button>
                </form>
              </SettingForm>
            ) : (
              <SettingForm label="Target weight">
                <form action={updateTargetWeightAction} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="userId" value={user.id} />
                  <input
                    className="field min-w-0"
                    name="targetWeight"
                    type="number"
                    step="0.01"
                    min="1"
                    defaultValue={user.targetWeight ?? undefined}
                    required
                  />
                  <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                    Save
                  </button>
                </form>
              </SettingForm>
            )}
          </div>

          {user.isPrivate ? (
            <div className="mt-4 rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-ink/60">
              {user.needsStartingWeight
                ? "The participant still needs to add their private starting weight after claim."
                : "The participant has already added a private starting weight. Raw values remain hidden here."}
            </div>
          ) : null}
        </SectionPanel>

        <SectionPanel
          title="Access and visibility"
          description="Privacy can be changed by admin only before claim. Role stays editable."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingForm label="Privacy mode">
              {user.adminCanTogglePrivacy ? (
                <form action={updateAdminPrivacyModeAction} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="userId" value={user.id} />
                  <select className="field min-w-0" name="privacyMode" defaultValue={user.isPrivate ? "private" : "public"}>
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
            </SettingForm>

            <SettingForm label="Role">
              <form action={updateUserRoleAction} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="userId" value={user.id} />
                <select className="field min-w-0" name="isAdmin" defaultValue={String(user.isAdmin)}>
                  <option value="false">Member</option>
                  <option value="true">Admin</option>
                </select>
                <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
                  Save
                </button>
              </form>
            </SettingForm>
          </div>
        </SectionPanel>

        <SectionPanel
          title="Remove profile"
          description="Deleting a user also removes their entries and monthly results."
          tone="danger"
        >
          <DeleteUserForm
            userId={user.id}
            userName={user.name}
            disabled={user.id === sessionUserId || (user.isAdmin && adminCount <= 1)}
            disabledReason={
              user.id === sessionUserId
                ? "You cannot remove your own profile."
                : user.isAdmin && adminCount <= 1
                  ? "Keep at least one admin profile."
                  : undefined
            }
          />
        </SectionPanel>
      </div>
    </article>
  );
}

function AdminOnlyCard({
  user,
  sessionUserId,
  adminCount,
}: {
  user: AdminUserSummary;
  sessionUserId: string;
  adminCount: number;
}) {
  return (
    <article className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold [font-family:var(--font-heading)]">{user.name}</h3>
            <span className="status-chip bg-sand text-ink/75">Admin-only access</span>
            {user.isAdmin ? <span className="status-chip bg-white text-ink/65">Admin</span> : null}
          </div>
          <p className="mt-2 text-sm text-ink/60">{user.email ?? "No email linked yet"}</p>
        </div>

        <div className="w-full panel-muted px-4 py-3 sm:w-auto">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Tracking</p>
          <p className="mt-2 text-sm font-semibold text-ink">Excluded from leaderboards and penalties</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
        <SectionPanel
          title="Role"
          description="This account can manage the app without joining the tracked participant list."
        >
          <form action={updateUserRoleAction} className="flex max-w-sm flex-col gap-2 sm:flex-row">
            <input type="hidden" name="userId" value={user.id} />
            <select className="field min-w-0" name="isAdmin" defaultValue={String(user.isAdmin)}>
              <option value="false">Member</option>
              <option value="true">Admin</option>
            </select>
            <button className="secondary-button w-full px-4 py-2 sm:w-auto" type="submit">
              Save
            </button>
          </form>
        </SectionPanel>

        <SectionPanel
          title="Remove profile"
          description="Delete this access-only account if it is no longer needed."
          tone="danger"
        >
          <DeleteUserForm
            userId={user.id}
            userName={user.name}
            disabled={user.id === sessionUserId || (user.isAdmin && adminCount <= 1)}
            disabledReason={
              user.id === sessionUserId
                ? "You cannot remove your own profile."
                : user.isAdmin && adminCount <= 1
                  ? "Keep at least one admin profile."
                  : undefined
            }
          />
        </SectionPanel>
      </div>
    </article>
  );
}

function ParticipantGroup({
  title,
  description,
  users,
  sessionUserId,
  adminCount,
  emptyMessage,
}: {
  title: string;
  description: string;
  users: AdminUserSummary[];
  sessionUserId: string;
  adminCount: number;
  emptyMessage: string;
}) {
  return (
    <section className="panel mb-6 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">{title}</h2>
          <p className="mt-1 text-sm text-ink/65">{description}</p>
        </div>
        <span className="status-chip bg-white text-ink/60">{users.length} profiles</span>
      </div>

      {users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/60">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-4">
          {users.map((user) => (
            <ParticipantCard key={user.id} user={user} sessionUserId={sessionUserId} adminCount={adminCount} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AdminPage() {
  const session = await requireAdminSession();
  const { users, entries, monthPolicies } = await getAdminPayload();
  const adminCount = users.filter((user) => user.isAdmin).length;
  const participants = users.filter((user) => user.isParticipant);
  const pendingParticipants = participants.filter((user) => !user.hasLoginAccess);
  const activeParticipants = participants.filter((user) => user.hasLoginAccess);
  const publicParticipants = participants.filter((user) => !user.isPrivate);
  const privateParticipants = participants.filter((user) => user.isPrivate);
  const adminOnlyUsers = users.filter((user) => !user.isParticipant);
  const totalRmOwed = participants.reduce((sum, user) => sum + user.totalRmOwed, 0);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-moss">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold [font-family:var(--font-heading)]">Manage users and entries</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink/70">
            Participants now live in focused cards, so rules, targets, and access stay grouped together instead of spreading across a wide table.
          </p>
        </div>
        <Link className="secondary-button" href="/dashboard">
          Back to dashboard
        </Link>
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewCard
          label="Tracked participants"
          value={participants.length}
          detail={`${activeParticipants.length} active and ${pendingParticipants.length} waiting to claim`}
        />
        <OverviewCard
          label="Private profiles"
          value={privateParticipants.length}
          detail={`${publicParticipants.length} public profiles are visible with full weights`}
        />
        <OverviewCard
          label="Admin-only access"
          value={adminOnlyUsers.length}
          detail="Separate manager accounts that are not tracked as participants"
        />
        <OverviewCard
          label="Total RM owed"
          value={formatRm(totalRmOwed)}
          detail="Combined amount across all tracked participants"
        />
      </section>

      <CreateParticipantForm />

      <section className="panel mb-6 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">Special month rules</h2>
            <p className="mt-1 text-sm text-ink/65">
              Apply one group-wide percentage for a calendar month. Example: `75%` means everyone only needs 75% of their own monthly target that month.
            </p>
          </div>
          <span className="status-chip bg-white text-ink/60">{monthPolicies.length} special months</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <SectionPanel
            title="Add or update a month"
            description="Saving 100% removes the override and returns that month to normal rules."
          >
            <form action={upsertMonthPolicyAction} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <label className="block space-y-2 text-sm font-medium text-ink">
                <span>Month</span>
                <input className="field" name="month" type="month" defaultValue={currentMonthInputValue()} required />
              </label>

              <label className="block space-y-2 text-sm font-medium text-ink">
                <span>Required % of target</span>
                <input className="field" name="requiredTargetPct" type="number" min="1" max="200" step="1" defaultValue={75} required />
              </label>

              <div className="flex items-end">
                <button className="primary-button w-full md:w-auto" type="submit">
                  Save rule
                </button>
              </div>
            </form>
          </SectionPanel>

          <SectionPanel
            title="Configured months"
            description="These overrides affect current-month status and closed-month penalties for every participant."
          >
            {monthPolicies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/60">
                No special month rules yet.
              </div>
            ) : (
              <div className="space-y-3">
                {monthPolicies.map((policy) => (
                  <div key={policy.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/80 px-4 py-3">
                    <div>
                      <p className="font-semibold text-ink">{getMonthLabel(policy.month, policy.year)}</p>
                      <p className="mt-1 text-sm text-ink/60">{policy.requiredTargetPct}% of each participant&apos;s monthly target</p>
                    </div>
                    <form action={deleteMonthPolicyAction}>
                      <input type="hidden" name="policyId" value={policy.id} />
                      <button className="secondary-button px-4 py-2" type="submit">
                        Remove
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </SectionPanel>
        </div>
      </section>

      <ParticipantGroup
        title="Pending claims"
        description="These profiles are ready for backfill and code sharing. Admin can still switch privacy before claim."
        users={pendingParticipants}
        sessionUserId={session.user.id}
        adminCount={adminCount}
        emptyMessage="No pending claim profiles right now."
      />

      <ParticipantGroup
        title="Active participants"
        description="Claimed participants can log in now. Privacy becomes participant-controlled after claim."
        users={activeParticipants}
        sessionUserId={session.user.id}
        adminCount={adminCount}
        emptyMessage="No active participant profiles yet."
      />

      {adminOnlyUsers.length > 0 ? (
        <section className="panel mb-6 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">Admin-only access</h2>
              <p className="mt-1 text-sm text-ink/65">
                These accounts manage the app but do not appear in participant tracking.
              </p>
            </div>
            <span className="status-chip bg-white text-ink/60">{adminOnlyUsers.length} profiles</span>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {adminOnlyUsers.map((user) => (
              <AdminOnlyCard
                key={user.id}
                user={user}
                sessionUserId={session.user.id}
                adminCount={adminCount}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold [font-family:var(--font-heading)]">Backfill and edit participant history</h2>
            <p className="mt-1 text-sm text-ink/65">
              Public participants use actual weights. Private participants use change logs only until they claim and add their own starting weight.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">
            <span className="rounded-full bg-sand px-3 py-1">Public {publicParticipants.length}</span>
            <span className="rounded-full bg-sand px-3 py-1">Private {privateParticipants.length}</span>
            <span className="rounded-full bg-sand px-3 py-1">Entries {entries.length}</span>
          </div>
        </div>

        <div className="mb-6 grid gap-4 xl:grid-cols-2">
          <SectionPanel
            title="Add public weigh-in"
            description="Use this for participants whose raw weight can be managed openly."
          >
            {publicParticipants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 px-4 py-6 text-center text-sm text-ink/60">
                No public participants right now.
              </div>
            ) : (
              <form
                action={createWeightEntryAction}
                className="grid gap-4 rounded-2xl border border-black/10 bg-white/80 p-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto]"
              >
                <label className="block space-y-2 text-sm font-medium text-ink">
                  <span>Participant</span>
                  <select className="field" name="userId" defaultValue="" required>
                    <option value="" disabled>
                      Select a public participant
                    </option>
                    {publicParticipants.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2 text-sm font-medium text-ink">
                  <span>Weight</span>
                  <input className="field" name="weight" type="number" step="0.01" min="1" required />
                </label>

                <label className="block space-y-2 text-sm font-medium text-ink">
                  <span>Date</span>
                  <input className="field" name="date" type="date" defaultValue={currentDateInputValue()} required />
                </label>

                <div className="flex items-end">
                  <button className="primary-button w-full lg:w-auto" type="submit">
                    Add entry
                  </button>
                </div>
              </form>
            )}
          </SectionPanel>

          <SectionPanel
            title="Add private progress update"
            description="Use positive numbers for loss and negative numbers for gain."
          >
            {privateParticipants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 px-4 py-6 text-center text-sm text-ink/60">
                No private participants right now.
              </div>
            ) : (
              <form
                action={createPrivateProgressEntryAction}
                className="grid gap-4 rounded-2xl border border-black/10 bg-white/80 p-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto]"
              >
                <label className="block space-y-2 text-sm font-medium text-ink">
                  <span>Participant</span>
                  <select className="field" name="userId" defaultValue="" required>
                    <option value="" disabled>
                      Select a private participant
                    </option>
                    {privateParticipants.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2 text-sm font-medium text-ink">
                  <span>Change</span>
                  <input className="field" name="lossKg" type="number" step="0.01" required />
                </label>

                <label className="block space-y-2 text-sm font-medium text-ink">
                  <span>Date</span>
                  <input className="field" name="date" type="date" defaultValue={currentDateInputValue()} required />
                </label>

                <div className="flex items-end">
                  <button className="primary-button w-full lg:w-auto" type="submit">
                    Add update
                  </button>
                </div>
              </form>
            )}
          </SectionPanel>
        </div>

        {participants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/60">
            Create a participant profile first.
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 px-4 py-8 text-center text-sm text-ink/60">
            No participant entries recorded yet.
          </div>
        ) : (
          <>
            <div className="space-y-4 sm:hidden">
              {entries.map((entry) => (
                <article key={entry.id} className="rounded-3xl border border-black/10 bg-white/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{entry.userName}</p>
                      <p className="text-xs text-ink/55">{entry.userEmail ?? "No email linked yet"}</p>
                    </div>
                    <span className="status-chip bg-sand text-ink/70">
                      {entry.entryType === "ABSOLUTE" ? "Weight" : entry.userIsPrivate ? "Private change" : "Change log"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="panel-muted p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Recorded on</p>
                      <p className="mt-1 font-semibold text-ink">{formatDate(new Date(entry.isoDate))}</p>
                    </div>
                    <div className="panel-muted p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Visible now</p>
                      {entry.userIsPrivate ? (
                        <>
                          <p className="mt-1 font-semibold text-ink">{formatWeight(entry.totalKgLost)} total lost</p>
                          <p className="mt-1 text-xs text-ink/55">
                            {entry.lossKg !== null ? formatLossDelta(entry.lossKg) : "Private"}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="mt-1 font-semibold text-ink">
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
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Adjust entry</p>
                    {entry.entryType === "ABSOLUTE" ? (
                      <form action={updateWeightEntryAction} className="space-y-2">
                        <input type="hidden" name="entryId" value={entry.id} />
                        <input type="hidden" name="userId" value={entry.userId} />
                        <input
                          aria-label="Weight"
                          className="field"
                          name="weight"
                          type="number"
                          step="0.01"
                          min="1"
                          defaultValue={entry.weight ?? undefined}
                          required
                        />
                        <input
                          aria-label="Date"
                          className="field"
                          name="date"
                          type="date"
                          defaultValue={formatDateInput(new Date(entry.isoDate))}
                          required
                        />
                        <button className="secondary-button w-full px-4 py-2" type="submit">
                          Save
                        </button>
                      </form>
                    ) : (
                      <form action={updatePrivateProgressEntryAction} className="space-y-2">
                        <input type="hidden" name="entryId" value={entry.id} />
                        <input type="hidden" name="userId" value={entry.userId} />
                        <input
                          aria-label="Change"
                          className="field"
                          name="lossKg"
                          type="number"
                          step="0.01"
                          defaultValue={entry.lossKg ?? undefined}
                          required
                        />
                        <input
                          aria-label="Date"
                          className="field"
                          name="date"
                          type="date"
                          defaultValue={formatDateInput(new Date(entry.isoDate))}
                          required
                        />
                        <button className="secondary-button w-full px-4 py-2" type="submit">
                          Save
                        </button>
                      </form>
                    )}
                  </div>

                  <div className="mt-4">
                    <DeleteWeightEntryForm
                      entryId={entry.id}
                      userName={entry.userName}
                      entryDate={formatDate(new Date(entry.isoDate))}
                      valueLabel={
                        entry.entryType === "ABSOLUTE" && entry.visibleWeight !== null
                          ? formatWeight(entry.visibleWeight)
                          : entry.lossKg !== null
                            ? formatLossDelta(entry.lossKg)
                            : "entry"
                      }
                    />
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.16em] text-ink/45">
                  <tr>
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Entry type</th>
                    <th className="pb-3 font-medium">Adjust entry</th>
                    <th className="pb-3 font-medium">Recorded on</th>
                    <th className="pb-3 font-medium">Visible now</th>
                    <th className="pb-3 font-medium">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-4 pr-4 align-top">
                        <p className="font-semibold text-ink">{entry.userName}</p>
                        <p className="text-xs text-ink/55">{entry.userEmail ?? "No email linked yet"}</p>
                      </td>
                      <td className="py-4 pr-4 align-top font-semibold text-ink">
                        {entry.entryType === "ABSOLUTE" ? "Weight" : entry.userIsPrivate ? "Private change" : "Change log"}
                      </td>
                      <td className="py-4 pr-4 align-top">
                        {entry.entryType === "ABSOLUTE" ? (
                          <form action={updateWeightEntryAction} className="grid min-w-[18rem] gap-2 md:grid-cols-[1fr_1fr_auto]">
                            <input type="hidden" name="entryId" value={entry.id} />
                            <input type="hidden" name="userId" value={entry.userId} />
                            <input
                              aria-label="Weight"
                              className="field min-w-0"
                              name="weight"
                              type="number"
                              step="0.01"
                              min="1"
                              defaultValue={entry.weight ?? undefined}
                              required
                            />
                            <input
                              aria-label="Date"
                              className="field min-w-0"
                              name="date"
                              type="date"
                              defaultValue={formatDateInput(new Date(entry.isoDate))}
                              required
                            />
                            <button className="secondary-button px-4 py-2" type="submit">
                              Save
                            </button>
                          </form>
                        ) : (
                          <form action={updatePrivateProgressEntryAction} className="grid min-w-[18rem] gap-2 md:grid-cols-[1fr_1fr_auto]">
                            <input type="hidden" name="entryId" value={entry.id} />
                            <input type="hidden" name="userId" value={entry.userId} />
                            <input
                              aria-label="Change"
                              className="field min-w-0"
                              name="lossKg"
                              type="number"
                              step="0.01"
                              defaultValue={entry.lossKg ?? undefined}
                              required
                            />
                            <input
                              aria-label="Date"
                              className="field min-w-0"
                              name="date"
                              type="date"
                              defaultValue={formatDateInput(new Date(entry.isoDate))}
                              required
                            />
                            <button className="secondary-button px-4 py-2" type="submit">
                              Save
                            </button>
                          </form>
                        )}
                      </td>
                      <td className="py-4 pr-4 align-top font-semibold text-ink">{formatDate(new Date(entry.isoDate))}</td>
                      <td className="py-4 align-top text-ink/55">
                        {entry.userIsPrivate ? (
                          <div>
                            <p className="font-semibold text-ink">{formatWeight(entry.totalKgLost)} total lost</p>
                            <p className="mt-1 text-xs text-ink/55">
                              {entry.lossKg !== null ? formatLossDelta(entry.lossKg) : "Private"}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-semibold text-ink">
                              {entry.visibleWeight !== null ? formatWeight(entry.visibleWeight) : "Not available"}
                            </p>
                            {entry.entryType === "LOSS_DELTA" && entry.lossKg !== null ? (
                              <p className="mt-1 text-xs text-ink/55">{formatLossDelta(entry.lossKg)}</p>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="py-4 align-top">
                        <DeleteWeightEntryForm
                          entryId={entry.id}
                          userName={entry.userName}
                          entryDate={formatDate(new Date(entry.isoDate))}
                          valueLabel={
                            entry.entryType === "ABSOLUTE" && entry.visibleWeight !== null
                              ? formatWeight(entry.visibleWeight)
                              : entry.lossKg !== null
                                ? formatLossDelta(entry.lossKg)
                                : "entry"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
