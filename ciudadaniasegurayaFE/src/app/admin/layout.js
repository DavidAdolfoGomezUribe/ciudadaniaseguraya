import { AdminShell } from "@/components/admin/AdminShell";
import { AdminRouteGuard } from "@/features/admin/auth/components/AdminRouteGuard";

export const metadata = {
  title: {
    default: "Panel administrativo",
    template: "%s · Administración CSY",
  },
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminLayout({ children }) {
  return (
    <AdminRouteGuard>
      <AdminShell>{children}</AdminShell>
    </AdminRouteGuard>
  );
}
