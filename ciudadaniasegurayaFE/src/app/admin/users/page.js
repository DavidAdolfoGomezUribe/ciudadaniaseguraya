import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";
import { AdminUsersPage } from "@/features/admin/users/components/AdminUsersPage";

export const metadata = { title: "Usuarios" };

export default function UsersPage() {
  return (
    <PermissionGate
      any={[ADMIN_PERMISSIONS.USERS_READ]}
      fallback={<AdminAccessDenied />}
    >
      <AdminUsersPage />
    </PermissionGate>
  );
}
