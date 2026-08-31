import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { AdminSettingsPage } from "@/features/admin/settings/components/AdminSettingsPage";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";

export const metadata = { title: "Configuración" };

export default function SettingsPage() {
  return (
    <PermissionGate
      any={[ADMIN_PERMISSIONS.SETTINGS_READ]}
      fallback={<AdminAccessDenied />}
    >
      <AdminSettingsPage />
    </PermissionGate>
  );
}
