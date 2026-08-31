import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { AdminIncidentDetail } from "@/features/admin/incidents/components/AdminIncidentDetail";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";

export const metadata = { title: "Revisión de incidente" };

export default async function IncidentDetailPage({ params }) {
  const { incidentId } = await params;
  return (
    <PermissionGate
      any={[ADMIN_PERMISSIONS.INCIDENTS_READ]}
      fallback={<AdminAccessDenied />}
    >
      <AdminIncidentDetail incidentId={incidentId} />
    </PermissionGate>
  );
}
