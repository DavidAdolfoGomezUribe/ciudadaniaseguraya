import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { AdminAdministratorDetail } from "@/features/admin/administrators/components/AdminAdministratorDetail";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";

export const metadata = { title: "Detalle de administrador" };

export default async function AdministratorDetailPage({ params }) {
  const { adminId } = await params;
  return (
    <PermissionGate
      any={[ADMIN_PERMISSIONS.ADMINS_READ]}
      fallback={<AdminAccessDenied />}
    >
      <AdminAdministratorDetail adminId={adminId} />
    </PermissionGate>
  );
}
