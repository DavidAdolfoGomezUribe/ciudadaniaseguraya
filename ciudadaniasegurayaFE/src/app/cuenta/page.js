"use client";

import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SystemPanel } from "@/components/ui/SystemPanel";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { PublicAdminRoleRequestPanel } from "@/features/admin/admin-requests/components/PublicAdminRoleRequestPanel";

const roleLabels = Object.freeze({
  user: "USUARIO",
  admin: "ADMINISTRADOR",
  superadmin: "SUPERADMIN",
});

export default function AccountPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="page-grid py-12">
      <div className="mb-8 max-w-2xl">
        <p className="technical-label">CUENTA · PERFIL BÁSICO</p>
        <h1 className="mt-3 text-4xl">Tu información</h1>
        <p className="text-[var(--foreground-secondary)]">
          Este módulo muestra únicamente los datos necesarios para tu cuenta.
        </p>
      </div>
      <SystemPanel className="max-w-2xl p-6">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="technical-label mb-1">USUARIO</dt>
            <dd className="m-0">{user.username}</dd>
          </div>
          <div>
            <dt className="technical-label mb-1">CORREO</dt>
            <dd className="m-0 break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="technical-label mb-1">ESTADO</dt>
            <dd className="m-0">
              <StatusBadge tone="success">CUENTA ACTIVA</StatusBadge>
            </dd>
          </div>
          <div>
            <dt className="technical-label mb-1">VERIFICACIÓN DE CORREO</dt>
            <dd className="m-0">
              <StatusBadge tone={user.emailVerified ? "success" : "warning"}>
                {user.emailVerified ? "VERIFICADO" : "PENDIENTE"}
              </StatusBadge>
            </dd>
          </div>
          <div>
            <dt className="technical-label mb-1">ROL</dt>
            <dd className="m-0">
              <StatusBadge tone={user.role === "user" ? "neutral" : "info"}>
                {roleLabels[user.role] || user.role}
              </StatusBadge>
            </dd>
          </div>
        </dl>
        <ButtonLink href="/reportar-incidente" className="mt-7">
          REPORTAR INCIDENTE
        </ButtonLink>
      </SystemPanel>
      <PublicAdminRoleRequestPanel />
    </div>
  );
}
