import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { AdminDashboard } from "@/features/admin/dashboard/components/AdminDashboard";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";

export default function AdminDashboardPage() {
  return (
    <PermissionGate
      any={[ADMIN_PERMISSIONS.DASHBOARD_READ]}
      fallback={<AdminAccessDenied />}
    >
      <AdminDashboard />
    </PermissionGate>
  );
}
