import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { AdminRequestsPage } from "@/features/admin/admin-requests/components/AdminRequestsPage";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";

export const metadata = { title: "Solicitudes administrativas" };

export default function AdminRoleRequestsPage() {
  return (
    <PermissionGate
      any={[
        ADMIN_PERMISSIONS.ADMIN_REQUESTS_READ,
        ADMIN_PERMISSIONS.ADMIN_REQUESTS_CREATE,
      ]}
      fallback={<AdminAccessDenied />}
    >
      <AdminRequestsPage />
    </PermissionGate>
  );
}
