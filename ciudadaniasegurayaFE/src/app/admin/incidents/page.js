import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { AdminIncidentsPage } from "@/features/admin/incidents/components/AdminIncidentsPage";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";

export const metadata = { title: "Incidentes pendientes" };

export default function IncidentsPage() {
  return (
    <PermissionGate
      any={[ADMIN_PERMISSIONS.INCIDENTS_READ]}
      fallback={<AdminAccessDenied />}
    >
      <AdminIncidentsPage />
    </PermissionGate>
  );
}
