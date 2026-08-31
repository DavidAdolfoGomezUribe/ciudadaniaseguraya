import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { AdministratorsPage } from "@/features/admin/administrators/components/AdministratorsPage";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";

export const metadata = { title: "Administradores" };

export default function AdminAdministratorsPage() {
  return (
    <PermissionGate
      any={[ADMIN_PERMISSIONS.ADMINS_READ]}
      fallback={<AdminAccessDenied />}
    >
      <AdministratorsPage />
    </PermissionGate>
  );
}
