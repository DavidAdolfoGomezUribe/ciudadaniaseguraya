"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut, MapPinPlus, ShieldCheck, UserRound } from "lucide-react";

import { buttonClassName } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { ThemeToggle } from "@/features/theme/components/ThemeToggle";
import { adminRoutes } from "@/lib/navigation/admin-routes";

export function Header() {
  const { isAuthenticated, logout, status, user } = useAuth();
  const [open, setOpen] = useState(false);
  const hasAdministrativeRole = ["admin", "superadmin"].includes(user?.role);
  const administrativeLabel =
    user?.role === "superadmin" ? "Panel de superadmin" : "Panel administrativo";

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-primary)] bg-[var(--header-surface)]">
      <div className="page-grid flex h-[var(--header-height)] items-center justify-between gap-4">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-3 no-underline"
          aria-label="Ciudadanía Segura Ya, página principal"
        >
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center border border-[var(--foreground-primary)] font-mono text-[0.65rem] font-bold"
          >
            CSY
          </span>
          <span className="truncate text-sm font-bold uppercase tracking-[0.08em] sm:text-base">
            Ciudadanía Segura Ya
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {status === "loading" ? (
            <span className="technical-label pulse-dot" aria-live="polite">
              SESIÓN
            </span>
          ) : !isAuthenticated ? (
            <Link href="/login" className={buttonClassName({ variant: "secondary" })}>
              INICIAR SESIÓN
            </Link>
          ) : (
            <div className="relative">
              <button
                type="button"
                className={buttonClassName({ variant: "secondary" })}
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen((value) => !value)}
              >
                <UserRound size={16} aria-hidden="true" />
                CUENTA
              </button>
              {open ? (
                <div
                  role="menu"
                  className="system-panel absolute right-0 mt-2 grid min-w-60 p-2"
                >
                  <p className="mb-1 border-b border-[var(--border-soft)] px-3 py-2 text-xs text-[var(--foreground-secondary)]">
                    {user?.username}
                  </p>
                  <Link
                    role="menuitem"
                    href="/cuenta"
                    className="flex min-h-11 items-center gap-2 px-3 text-sm hover:bg-[var(--background-secondary)]"
                    onClick={() => setOpen(false)}
                  >
                    <UserRound size={16} aria-hidden="true" /> Mi perfil
                  </Link>
                  <Link
                    role="menuitem"
                    href="/reportar-incidente"
                    className="flex min-h-11 items-center gap-2 px-3 text-sm hover:bg-[var(--background-secondary)]"
                    onClick={() => setOpen(false)}
                  >
                    <MapPinPlus size={16} aria-hidden="true" /> Reportar incidente
                  </Link>
                  {hasAdministrativeRole ? (
                    <Link
                      role="menuitem"
                      href={adminRoutes.dashboard}
                      className="flex min-h-11 items-center gap-2 px-3 text-sm hover:bg-[var(--background-secondary)]"
                      onClick={() => setOpen(false)}
                    >
                      <ShieldCheck size={16} aria-hidden="true" />
                      {administrativeLabel}
                    </Link>
                  ) : null}
                  <button
                    role="menuitem"
                    type="button"
                    className="flex min-h-11 items-center gap-2 px-3 text-left text-sm hover:bg-[var(--background-secondary)]"
                    onClick={async () => {
                      setOpen(false);
                      await logout();
                    }}
                  >
                    <LogOut size={16} aria-hidden="true" /> Cerrar sesión
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
