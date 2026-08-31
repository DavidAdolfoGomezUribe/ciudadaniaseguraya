"use client";

import {
  Activity,
  FileCheck2,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Bot,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAdminSession } from "@/features/admin/auth/components/AdminSessionProvider";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";
import { adminRoutes } from "@/lib/navigation/admin-routes";
import { classNames } from "@/lib/utils/class-names";

const navigation = [
  {
    label: "RESUMEN",
    href: adminRoutes.dashboard,
    icon: LayoutDashboard,
    any: [ADMIN_PERMISSIONS.DASHBOARD_READ],
  },
  {
    label: "INCIDENTES",
    href: adminRoutes.incidents,
    icon: FileCheck2,
    any: [ADMIN_PERMISSIONS.INCIDENTS_READ],
  },
  {
    label: "GESTIONAR USUARIOS",
    href: adminRoutes.users,
    icon: Users,
    any: [ADMIN_PERMISSIONS.USERS_READ, ADMIN_PERMISSIONS.ADMINS_READ],
    activePaths: [adminRoutes.users, adminRoutes.administrators],
  },
  {
    label: "SOLICITUDES ADMIN",
    href: adminRoutes.adminRequests,
    icon: ShieldCheck,
    any: [
      ADMIN_PERMISSIONS.ADMIN_REQUESTS_READ,
      ADMIN_PERMISSIONS.ADMIN_REQUESTS_CREATE,
    ],
  },
  {
    label: "PUBLICACIONES",
    href: adminRoutes.posts,
    icon: FileText,
    any: [ADMIN_PERMISSIONS.POSTS_MODERATE],
  },
  {
    label: "COMENTARIOS",
    href: adminRoutes.comments,
    icon: MessageSquare,
    any: [ADMIN_PERMISSIONS.COMMENTS_MODERATE],
  },
  {
    label: "AGENTE IA",
    href: adminRoutes.agent,
    icon: Bot,
    any: [ADMIN_PERMISSIONS.AGENT_CONTROL],
  },
  {
    label: "AUDITORÍA",
    href: adminRoutes.audit,
    icon: Activity,
    any: [ADMIN_PERMISSIONS.AUDIT_READ_OWN, ADMIN_PERMISSIONS.AUDIT_READ_ALL],
  },
  {
    label: "CONFIGURACIÓN",
    href: adminRoutes.settings,
    icon: Settings,
    any: [ADMIN_PERMISSIONS.SETTINGS_READ],
  },
];

export function AdminSidebar({ open, onClose }) {
  const pathname = usePathname();
  const { permissions } = useAdminSession();
  const items = navigation.filter((item) =>
    item.any.some((permission) => permissions.has(permission)),
  );

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Cerrar navegación administrativa"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        aria-label="Navegación administrativa"
        className={classNames(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[var(--border-primary)]",
          "bg-[var(--background-secondary)] transition-transform lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex min-h-20 items-center justify-between border-b border-[var(--border-primary)] px-5">
          <Link href={adminRoutes.dashboard} className="no-underline" onClick={onClose}>
            <span className="technical-label block">CIUDADANÍA SEGURA YA</span>
            <span className="mt-1 block text-sm font-semibold">
              CONTROL ADMINISTRATIVO
            </span>
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center lg:hidden"
            aria-label="Cerrar menú"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="m-0 grid list-none gap-1 p-0">
            {items.map(({ label, href, icon: Icon, activePaths = [href] }) => {
              const active = activePaths.some(
                (path) =>
                  pathname === path ||
                  (path !== adminRoutes.dashboard && pathname.startsWith(`${path}/`)),
              );
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={onClose}
                    className={classNames(
                      "flex min-h-12 items-center gap-3 border px-3 font-mono text-[0.7rem]",
                      "font-bold tracking-[0.09em] no-underline",
                      active
                        ? "border-[var(--foreground-primary)] bg-[var(--selection-primary)] text-[var(--selection-foreground)]"
                        : "border-transparent hover:border-[var(--border-primary)] hover:bg-[var(--background-elevated)]",
                    )}
                  >
                    <Icon size={17} aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-[var(--border-primary)] p-4">
          <p className="technical-label mb-1">ENTORNO AUDITADO</p>
          <p className="mb-0 text-xs text-[var(--foreground-secondary)]">
            Cada operación crítica exige motivo y queda registrada.
          </p>
        </div>
      </aside>
    </>
  );
}
