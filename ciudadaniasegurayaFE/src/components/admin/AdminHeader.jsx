"use client";

import { Bell, LogOut, Menu, Radio, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAdminSession } from "@/features/admin/auth/components/AdminSessionProvider";
import { useAdminRealtimeStore } from "@/features/admin/realtime/state/admin-realtime.store";
import { ThemeToggle } from "@/features/theme/components/ThemeToggle";
import { adminRoutes } from "@/lib/navigation/admin-routes";

export function AdminHeader({ onOpenMenu }) {
  const router = useRouter();
  const { logout, user } = useAdminSession();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const realtimeStatus = useAdminRealtimeStore((state) => state.status);
  const notifications = useAdminRealtimeStore((state) => state.notifications);
  const clearNotifications = useAdminRealtimeStore((state) => state.clear);

  return (
    <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-3 border-b border-[var(--border-primary)] bg-[var(--header-surface)] px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="grid size-11 shrink-0 place-items-center border border-[var(--border-primary)] lg:hidden"
          aria-label="Abrir menú administrativo"
          onClick={onOpenMenu}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <p className="technical-label mb-0 truncate">
            {user?.displayName || user?.username}
          </p>
          <p className="mb-0 mt-1 flex items-center gap-2 text-xs text-[var(--foreground-secondary)]">
            <span className="font-mono font-bold uppercase">{user?.role}</span>
            <span aria-hidden="true">·</span>
            <Radio size={13} aria-hidden="true" />
            {realtimeStatus === "online"
              ? "EN LÍNEA"
              : realtimeStatus === "offline"
                ? "SIN CONEXIÓN"
                : "CONECTANDO"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <button
          type="button"
          className="relative grid size-11 place-items-center border border-[var(--border-primary)] bg-[var(--background-elevated)]"
          aria-label="Notificaciones administrativas"
          title="Notificaciones administrativas"
          aria-expanded={notificationsOpen}
          onClick={() => setNotificationsOpen((value) => !value)}
        >
          <Bell size={17} aria-hidden="true" />
          {notifications.length ? (
            <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[var(--danger-background)] font-mono text-[0.58rem] text-[var(--danger-foreground)]">
              {Math.min(notifications.length, 99)}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          aria-label="Cerrar sesión administrativa"
          className="inline-flex min-h-11 items-center gap-2 border border-[var(--border-primary)] bg-[var(--background-elevated)] px-3 font-mono text-[0.68rem] font-bold uppercase"
          onClick={async () => {
            await logout();
            router.replace(adminRoutes.login);
          }}
        >
          <LogOut size={16} aria-hidden="true" />
          <span className="hidden sm:inline">CERRAR SESIÓN</span>
        </button>
      </div>
      {notificationsOpen ? (
        <section className="system-panel absolute right-3 top-[calc(100%+0.5rem)] z-40 max-h-[70vh] w-[min(26rem,calc(100vw-1.5rem))] overflow-y-auto p-4 sm:right-6">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-3">
            <div>
              <p className="technical-label mb-1">EVENTOS ADMINISTRATIVOS</p>
              <p className="mb-0 text-xs text-[var(--foreground-secondary)]">
                Canal protegido · {realtimeStatus}
              </p>
            </div>
            <button
              type="button"
              className="grid size-10 place-items-center"
              aria-label="Cerrar notificaciones"
              onClick={() => setNotificationsOpen(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {notifications.length ? (
            <>
              <ol className="m-0 grid list-none gap-2 p-0">
                {notifications.map((notification, index) => (
                  <li
                    key={notification.id || `${notification.type}-${index}`}
                    className="border border-[var(--border-soft)] bg-[var(--background-secondary)] p-3"
                  >
                    <p className="technical-label mb-1">{notification.type}</p>
                    <p className="mb-0 text-xs text-[var(--foreground-secondary)]">
                      {notification.data?.message ||
                        notification.message ||
                        "Se actualizó un recurso administrativo."}
                    </p>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="mt-3 min-h-10 w-full border border-[var(--border-primary)] font-mono text-xs font-bold"
                onClick={clearNotifications}
              >
                LIMPIAR NOTIFICACIONES
              </button>
            </>
          ) : (
            <p className="mb-0 text-sm text-[var(--foreground-secondary)]">
              No hay eventos nuevos.
            </p>
          )}
        </section>
      ) : null}
    </header>
  );
}
