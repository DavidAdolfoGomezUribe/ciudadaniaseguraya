"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { FormField } from "@/components/forms/FormField";
import { SubmitStatus } from "@/components/forms/SubmitStatus";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SystemPanel } from "@/components/ui/SystemPanel";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";
import { adminRoutes } from "@/lib/navigation/admin-routes";
import { adminQueryKeys } from "@/lib/query/admin-query-keys";

import { adminService } from "../../services/admin.service";
import { formatAdminDate } from "../../shared/admin-data";

export function AdminUserDetail({ userId }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: adminQueryKeys.user(userId),
    queryFn: ({ signal }) => adminService.users.detail(userId, signal),
  });
  const [reason, setReason] = useState("");
  const [promoteOpen, setPromoteOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: (values) => adminService.users.update(userId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.user(userId) });
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setReason("");
    },
  });

  if (query.isLoading) {
    return <p className="technical-label pulse-dot">CARGANDO DETALLE DE USUARIO</p>;
  }
  if (query.isError) {
    return <SubmitStatus error={query.error} />;
  }
  const user = query.data;

  async function promoteUser(values) {
    await adminService.users.promote(userId, values);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "administrators"] }),
    ]);
    router.replace(adminRoutes.administrator(userId));
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="USUARIOS · DETALLE"
        title={user.displayName || user.username}
        description={`Identificador ${userId}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <PermissionGate any={[ADMIN_PERMISSIONS.ADMINS_PROMOTE]}>
              <Button onClick={() => setPromoteOpen(true)}>
                PROMOVER A ADMINISTRADOR
              </Button>
            </PermissionGate>
            <ButtonLink variant="secondary" href={adminRoutes.users}>
              VOLVER A USUARIOS
            </ButtonLink>
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.65fr)]">
        <SystemPanel className="p-5 sm:p-6">
          <h2 className="mb-5 text-xl">Información permitida</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="technical-label">CORREO</dt>
              <dd className="mt-1 break-all">{user.email || "—"}</dd>
            </div>
            <div>
              <dt className="technical-label">ROL</dt>
              <dd className="mt-1 font-mono font-bold uppercase">{user.role}</dd>
            </div>
            <div>
              <dt className="technical-label">ESTADO</dt>
              <dd className="mt-1">
                <AdminStatusBadge status={user.status} />
              </dd>
            </div>
            <div>
              <dt className="technical-label">REGISTRO</dt>
              <dd className="mt-1">{formatAdminDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt className="technical-label">ÚLTIMO ACCESO</dt>
              <dd className="mt-1">{formatAdminDate(user.lastLoginAt)}</dd>
            </div>
          </dl>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              ["INCIDENTES", user.incidentCount ?? user.counts?.incidents ?? 0],
              ["PUBLICACIONES", user.postCount ?? user.counts?.posts ?? 0],
              ["COMENTARIOS", user.commentCount ?? user.counts?.comments ?? 0],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border border-[var(--border-soft)] bg-[var(--background-secondary)] p-3"
              >
                <p className="technical-label mb-2">{label}</p>
                <p className="mb-0 font-mono text-2xl">{value}</p>
              </div>
            ))}
          </div>
        </SystemPanel>
        <SystemPanel className="p-5 sm:p-6">
          <h2 className="mb-2 text-xl">Corrección administrativa</h2>
          <p className="text-sm text-[var(--foreground-secondary)]">
            El rol, identificadores, tokens y conteos no forman parte de esta operación.
          </p>
          <form
            key={user.updatedAt || userId}
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              const displayName = String(values.get("displayName") || "").trim();
              mutation.mutate({
                displayName: displayName || null,
                username: String(values.get("username") || "").trim(),
                reason: reason.trim(),
              });
            }}
          >
            <FormField label="Display name" htmlFor="user-display-name">
              <Input
                id="user-display-name"
                name="displayName"
                maxLength={100}
                defaultValue={user.displayName || ""}
              />
            </FormField>
            <FormField label="Username" htmlFor="user-username" required>
              <Input
                id="user-username"
                name="username"
                maxLength={32}
                minLength={3}
                defaultValue={user.username || ""}
              />
            </FormField>
            <FormField
              label="Motivo de la corrección"
              htmlFor="user-update-reason"
              required
            >
              <textarea
                id="user-update-reason"
                rows={4}
                maxLength={1000}
                className="w-full border border-[var(--border-primary)] bg-[var(--background-elevated)] p-3"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
            <SubmitStatus
              error={mutation.error}
              success={mutation.isSuccess ? "Cambios guardados y auditados." : null}
            />
            <Button
              type="submit"
              disabled={mutation.isPending || reason.trim().length < 10}
            >
              {mutation.isPending ? "GUARDANDO" : "GUARDAR CAMBIOS"}
            </Button>
          </form>
        </SystemPanel>
      </div>
      <ConfirmationDialog
        open={promoteOpen}
        title="Promover a administrador"
        action="Asignar autoridad administrativa"
        resource={`${user.username} · ${userId}`}
        consequence="La cuenta pasará a la lista de administradores y sus sesiones actuales serán revocadas."
        confirmLabel="PROMOVER A ADMINISTRADOR"
        confirmVariant="primary"
        onClose={() => setPromoteOpen(false)}
        onConfirm={promoteUser}
      />
    </>
  );
}
