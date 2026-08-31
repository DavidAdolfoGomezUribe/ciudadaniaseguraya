"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SubmitStatus } from "@/components/forms/SubmitStatus";
import { SystemPanel } from "@/components/ui/SystemPanel";
import { useAdminSession } from "@/features/admin/auth/components/AdminSessionProvider";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";
import { adminRoutes } from "@/lib/navigation/admin-routes";
import { adminQueryKeys } from "@/lib/query/admin-query-keys";

import { adminService } from "../../services/admin.service";
import { formatAdminDate, resourceId } from "../../shared/admin-data";

const actionContent = {
  suspend: {
    title: "Suspender administrador",
    action: "Suspender la cuenta administrativa",
    consequence: "Perderá acceso al panel y se revocarán sus sesiones.",
    label: "SUSPENDER ADMIN",
  },
  reactivate: {
    title: "Reactivar administrador",
    action: "Restablecer la cuenta administrativa",
    consequence: "Recuperará el acceso según sus permisos efectivos.",
    label: "REACTIVAR ADMIN",
    variant: "primary",
  },
  demote: {
    title: "Degradar administrador",
    action: "Cambiar el rol a usuario normal",
    consequence: "Se revocarán sus sesiones administrativas y conservará su cuenta.",
    label: "DEGRADAR A USUARIO",
  },
  revoke: {
    title: "Revocar sesiones administrativas",
    action: "Cerrar todas las sesiones administrativas",
    consequence: "Deberá autenticarse nuevamente en cada dispositivo.",
    label: "REVOCAR SESIONES",
  },
};

export function AdminAdministratorDetail({ adminId }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: actor } = useAdminSession();
  const [activeAction, setActiveAction] = useState(null);
  const query = useQuery({
    queryKey: adminQueryKeys.administrator(adminId),
    queryFn: ({ signal }) => adminService.administrators.detail(adminId, signal),
  });

  if (query.isLoading) {
    return <p className="technical-label pulse-dot">CARGANDO ADMINISTRADOR</p>;
  }
  if (query.isError) return <SubmitStatus error={query.error} />;

  const administrator = query.data;
  const protectedAccount =
    administrator.role === "superadmin" ||
    administrator.isBootstrapSuperadmin ||
    resourceId(administrator) === actor?.id;
  const dialog = activeAction ? actionContent[activeAction] : null;

  async function completeAction(values) {
    const methods = {
      suspend: adminService.administrators.suspend,
      reactivate: adminService.administrators.reactivate,
      demote: adminService.administrators.demote,
      revoke: adminService.administrators.revokeSessions,
    };
    await methods[activeAction](adminId, values);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "administrators"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
    ]);
    if (activeAction === "demote") {
      router.replace(adminRoutes.user(adminId));
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.administrator(adminId),
    });
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="GESTIÓN DE USUARIOS · ADMINISTRADOR"
        title={administrator.displayName || administrator.username}
        description={`Rol persistido: ${administrator.role} · Identificador ${adminId}`}
        actions={
          <ButtonLink variant="secondary" href={adminRoutes.administrators}>
            VOLVER A ADMINISTRADORES
          </ButtonLink>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.65fr)]">
        <SystemPanel className="p-5 sm:p-6">
          <h2 className="mb-5 text-xl">Información administrativa</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="technical-label">USUARIO</dt>
              <dd className="mt-1">{administrator.username}</dd>
            </div>
            <div>
              <dt className="technical-label">CORREO</dt>
              <dd className="mt-1 break-all">{administrator.email || "Restringido"}</dd>
            </div>
            <div>
              <dt className="technical-label">ROL</dt>
              <dd className="mt-1">
                <AdminStatusBadge status={administrator.status}>
                  {administrator.role}
                </AdminStatusBadge>
              </dd>
            </div>
            <div>
              <dt className="technical-label">ESTADO</dt>
              <dd className="mt-1">
                <AdminStatusBadge status={administrator.status} />
              </dd>
            </div>
            <div>
              <dt className="technical-label">REGISTRO</dt>
              <dd className="mt-1">{formatAdminDate(administrator.createdAt)}</dd>
            </div>
            <div>
              <dt className="technical-label">PROMOCIÓN</dt>
              <dd className="mt-1">{formatAdminDate(administrator.promotedAt)}</dd>
            </div>
          </dl>
        </SystemPanel>
        <SystemPanel className="p-5 sm:p-6">
          <p className="technical-label mb-2">AUTORIDAD · ACCIONES</p>
          <h2 className="mb-2 text-xl">Controles del rol</h2>
          {protectedAccount ? (
            <p className="text-sm text-[var(--foreground-secondary)]">
              Esta cuenta está protegida y no puede degradarse, suspenderse ni
              modificarse desde este flujo.
            </p>
          ) : (
            <div className="mt-5 grid gap-2">
              <PermissionGate any={[ADMIN_PERMISSIONS.ADMINS_SUSPEND]}>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setActiveAction(
                      administrator.status === "suspended" ? "reactivate" : "suspend",
                    )
                  }
                >
                  {administrator.status === "suspended"
                    ? "REACTIVAR ADMINISTRADOR"
                    : "SUSPENDER ADMINISTRADOR"}
                </Button>
              </PermissionGate>
              <PermissionGate any={[ADMIN_PERMISSIONS.ADMINS_DEMOTE]}>
                <Button variant="danger" onClick={() => setActiveAction("demote")}>
                  DEGRADAR A USUARIO
                </Button>
              </PermissionGate>
              <PermissionGate any={[ADMIN_PERMISSIONS.ADMINS_UPDATE]}>
                <Button variant="ghost" onClick={() => setActiveAction("revoke")}>
                  REVOCAR SESIONES
                </Button>
              </PermissionGate>
            </div>
          )}
        </SystemPanel>
      </div>
      <ConfirmationDialog
        open={Boolean(activeAction)}
        {...dialog}
        resource={`${administrator.username} · ${adminId}`}
        confirmLabel={dialog?.label}
        confirmVariant={dialog?.variant || "danger"}
        onClose={() => setActiveAction(null)}
        onConfirm={completeAction}
      />
    </>
  );
}
