import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { getAdminPayload } from "@/lib/data";
import { requireAdminSession } from "@/lib/session";

export default async function AdminPage() {
  const session = await requireAdminSession();
  const { users, entries, monthPolicies } = await getAdminPayload();

  return (
    <AdminWorkspace
      entries={entries}
      monthPolicies={monthPolicies}
      sessionUserId={session.user.id}
      users={users}
    />
  );
}
