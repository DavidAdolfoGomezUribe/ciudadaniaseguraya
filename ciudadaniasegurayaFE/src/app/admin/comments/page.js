import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";
import { ModerationPage } from "@/features/admin/moderation/components/ModerationPage";

export const metadata = { title: "Moderación de comentarios" };

export default function CommentsModerationPage() {
  return (
    <PermissionGate
      any={[ADMIN_PERMISSIONS.COMMENTS_MODERATE]}
      fallback={<AdminAccessDenied />}
    >
      <ModerationPage resource="comments" />
    </PermissionGate>
  );
}
