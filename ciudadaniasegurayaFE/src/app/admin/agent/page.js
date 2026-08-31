import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { AgentControlPage } from "@/features/admin/agent/components/AgentControlPage";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";

export const metadata = { title: "Agente IA" };

export default function AgentPage() {
  return (
    <PermissionGate
      any={[ADMIN_PERMISSIONS.AGENT_CONTROL]}
      fallback={<AdminAccessDenied />}
    >
      <AgentControlPage />
    </PermissionGate>
  );
}
