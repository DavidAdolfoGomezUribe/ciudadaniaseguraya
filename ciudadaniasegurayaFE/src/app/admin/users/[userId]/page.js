import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";
import { AdminUserDetail } from "@/features/admin/users/components/AdminUserDetail";

export const metadata = { title: "Detalle de usuario" };

export default async function UserDetailPage({ params }) {
  const { userId } = await params;
  return (
    <PermissionGate
      any={[ADMIN_PERMISSIONS.USERS_READ]}
      fallback={<AdminAccessDenied />}
    >
      <AdminUserDetail userId={userId} />
    </PermissionGate>
  );
}
