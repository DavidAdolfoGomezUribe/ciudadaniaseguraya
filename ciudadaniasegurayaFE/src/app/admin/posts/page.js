import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";
import { ModerationPage } from "@/features/admin/moderation/components/ModerationPage";

export const metadata = { title: "Moderación de publicaciones" };

export default function PostsModerationPage() {
  return (
    <PermissionGate
      any={[ADMIN_PERMISSIONS.POSTS_MODERATE]}
      fallback={<AdminAccessDenied />}
    >
      <ModerationPage resource="posts" />
    </PermissionGate>
  );
}
