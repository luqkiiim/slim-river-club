import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { AppHeader, MobileBottomNav } from "@/components/app-chrome";
import { getAdminPayload } from "@/lib/data";
import { requireAdminSession } from "@/lib/session";

export default async function AdminPage() {
  const session = await requireAdminSession();
  const { users, entries, monthPolicies } = await getAdminPayload();

  return (
    <>
      <AppHeader
        currentUserId={session.user.isParticipant ? session.user.id : undefined}
        currentUserName={session.user.name ?? "Admin"}
        isAdmin
        isParticipant={session.user.isParticipant}
      />
      <AdminWorkspace
        entries={entries}
        monthPolicies={monthPolicies}
        sessionUserId={session.user.id}
        users={users}
      />
      <MobileBottomNav
        active="admin"
        currentUserId={session.user.isParticipant ? session.user.id : undefined}
        currentUserName={session.user.name ?? "Admin"}
        isAdmin
        isParticipant={session.user.isParticipant}
      />
    </>
  );
}
