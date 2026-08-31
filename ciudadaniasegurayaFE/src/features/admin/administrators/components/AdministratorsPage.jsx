"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { buttonClassName } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useAdminSession } from "@/features/admin/auth/components/AdminSessionProvider";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";
import { UserManagementTabs } from "@/features/admin/users/components/UserManagementTabs";
import { adminRoutes } from "@/lib/navigation/admin-routes";
import { adminQueryKeys } from "@/lib/query/admin-query-keys";

import { adminService } from "../../services/admin.service";
import {
  DEFAULT_PAGE_SIZE,
  formatAdminDate,
  resourceId,
} from "../../shared/admin-data";
import { useDebouncedValue } from "../../shared/use-debounced-value";

const actionContent = {
  suspend: {
    title: "Suspender administrador",
    action: "Suspender una cuenta administrativa",
    consequence: "Perderá acceso al panel y sus sesiones serán revocadas.",
    label: "SUSPENDER ADMIN",
  },
  reactivate: {
    title: "Reactivar administrador",
    action: "Restablecer una cuenta administrativa",
    consequence: "Recuperará el acceso conforme a sus permisos efectivos.",
    label: "REACTIVAR ADMIN",
    variant: "primary",
  },
  demote: {
    title: "Degradar administrador",
    action: "Cambiar el rol a usuario normal",
    consequence:
      "Se revocarán todas sus sesiones administrativas y se conservará la auditoría.",
    label: "DEGRADAR A USER",
  },
  revoke: {
    title: "Revocar sesiones administrativas",
    action: "Cerrar todas las sesiones del administrador",
    consequence: "Deberá autenticarse nuevamente en cada dispositivo.",
    label: "REVOCAR SESIONES",
  },
};

export function AdministratorsPage() {
  const queryClient = useQueryClient();
  const { user } = useAdminSession();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [activeAction, setActiveAction] = useState(null);
  const params = useMemo(
    () => ({
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      search: debouncedSearch,
      status,
    }),
    [debouncedSearch, page, status],
  );
  const query = useQuery({
    queryKey: adminQueryKeys.administrators(params),
    queryFn: ({ signal }) => adminService.administrators.list(params, signal),
  });

  async function completeAction(values) {
    const id = resourceId(activeAction.row);
    const methods = {
      suspend: adminService.administrators.suspend,
      reactivate: adminService.administrators.reactivate,
      demote: adminService.administrators.demote,
      revoke: adminService.administrators.revokeSessions,
    };
    await methods[activeAction.kind](id, values);
    await queryClient.invalidateQueries({ queryKey: ["admin", "administrators"] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  const columns = [
    {
      key: "username",
      header: "Administrador",
      render: (row) => (
        <div>
          <Link
            className="font-semibold underline"
            href={adminRoutes.administrator(resourceId(row))}
          >
            {row.username}
          </Link>
          <span className="mt-1 block text-xs text-[var(--foreground-secondary)]">
            {row.displayName || "Sin nombre visible"}
          </span>
        </div>
      ),
    },
    { key: "email", header: "Correo", render: (row) => row.email || "—" },
    {
      key: "role",
      header: "Rol",
      render: (row) => (
        <AdminStatusBadge status={row.status}>{row.role}</AdminStatusBadge>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (row) => <AdminStatusBadge status={row.status} />,
    },
    {
      key: "promotedAt",
      header: "Promoción",
      render: (row) => formatAdminDate(row.promotedAt || row.adminMetadata?.promotedAt),
    },
    {
      key: "actions",
      header: "Controles",
      render: (row) => {
        const protectedAccount =
          row.role === "superadmin" ||
          row.isBootstrapSuperadmin ||
          row.adminMetadata?.isBootstrapSuperadmin ||
          resourceId(row) === user?.id;
        return (
          <div className="flex flex-wrap gap-1">
            {protectedAccount ? (
              <span className="technical-label self-center text-[var(--foreground-muted)]">
                CUENTA PROTEGIDA
              </span>
            ) : (
              <>
                <PermissionGate any={[ADMIN_PERMISSIONS.ADMINS_SUSPEND]}>
                  {row.status === "suspended" ? (
                    <button
                      type="button"
                      className={buttonClassName({ variant: "secondary" })}
                      onClick={() => setActiveAction({ kind: "reactivate", row })}
                    >
                      REACTIVAR
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={buttonClassName({ variant: "secondary" })}
                      onClick={() => setActiveAction({ kind: "suspend", row })}
                    >
                      SUSPENDER
                    </button>
                  )}
                </PermissionGate>
                <PermissionGate any={[ADMIN_PERMISSIONS.ADMINS_DEMOTE]}>
                  <button
                    type="button"
                    className={buttonClassName({ variant: "danger" })}
                    onClick={() => setActiveAction({ kind: "demote", row })}
                  >
                    DEGRADAR
                  </button>
                </PermissionGate>
                <PermissionGate any={[ADMIN_PERMISSIONS.ADMINS_UPDATE]}>
                  <button
                    type="button"
                    className={buttonClassName({ variant: "ghost" })}
                    onClick={() => setActiveAction({ kind: "revoke", row })}
                  >
                    SESIONES
                  </button>
                </PermissionGate>
              </>
            )}
          </div>
        );
      },
    },
  ];
  const dialog = activeAction ? actionContent[activeAction.kind] : null;

  return (
    <>
      <AdminPageHeader
        eyebrow="ADMINISTRACIÓN · GESTIÓN DE CUENTAS"
        title="Gestionar usuarios"
        description="Consulta por separado usuarios normales y administradores. Solo el superadmin puede modificar autoridad."
      />
      <UserManagementTabs />
      <AdminFilters>
        <label className="grid gap-1 text-sm">
          <span className="technical-label">BUSCAR ADMINISTRADOR</span>
          <Input
            type="search"
            value={search}
            placeholder="Nombre, usuario o correo"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="technical-label">ESTADO</span>
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="suspended">Suspendidos</option>
          </Select>
        </label>
      </AdminFilters>
      <AdminDataTable
        caption="Administradores"
        columns={columns}
        rows={query.data?.items}
        rowKey={resourceId}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        pagination={query.data?.pagination}
        onPageChange={setPage}
      />
      <ConfirmationDialog
        open={Boolean(activeAction)}
        {...dialog}
        resource={
          activeAction
            ? `${activeAction.row.username} · ${resourceId(activeAction.row)}`
            : ""
        }
        confirmLabel={dialog?.label}
        confirmVariant={dialog?.variant || "danger"}
        onClose={() => setActiveAction(null)}
        onConfirm={completeAction}
      />
    </>
  );
}
