import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { AdminAuditPage } from "@/features/admin/audit/components/AdminAuditPage";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";

export const metadata = { title: "Auditoría" };

export default function AuditPage() {
  return (
    <PermissionGate
      any={[ADMIN_PERMISSIONS.AUDIT_READ_OWN, ADMIN_PERMISSIONS.AUDIT_READ_ALL]}
      fallback={<AdminAccessDenied />}
    >
      <AdminAuditPage />
    </PermissionGate>
  );
}
