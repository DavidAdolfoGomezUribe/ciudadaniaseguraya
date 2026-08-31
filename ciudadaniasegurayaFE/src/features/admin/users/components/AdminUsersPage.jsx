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
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";
import { adminRoutes } from "@/lib/navigation/admin-routes";
import { adminQueryKeys } from "@/lib/query/admin-query-keys";

import { adminService } from "../../services/admin.service";
import {
  DEFAULT_PAGE_SIZE,
  formatAdminDate,
  resourceId,
} from "../../shared/admin-data";
import { useDebouncedValue } from "../../shared/use-debounced-value";
import { UserManagementTabs } from "./UserManagementTabs";

const actionContent = {
  suspend: {
    title: "Suspender usuario",
    action: "Suspender el acceso de la cuenta",
    consequence: "Se impedirá el acceso hasta que un administrador la reactive.",
    label: "SUSPENDER",
  },
  reactivate: {
    title: "Reactivar usuario",
    action: "Restablecer el acceso de la cuenta",
    consequence: "La persona podrá volver a iniciar sesión.",
    label: "REACTIVAR",
    variant: "primary",
  },
  delete: {
    title: "Eliminar y anonimizar usuario",
    action: "Aplicar eliminación lógica y anonimización",
    consequence:
      "Se revocarán sus sesiones y se conservarán únicamente los registros necesarios.",
    label: "ELIMINAR",
    confirmationText: "ELIMINAR",
  },
  revoke: {
    title: "Revocar sesiones",
    action: "Cerrar todas las sesiones activas",
    consequence: "La persona deberá autenticarse nuevamente en todos sus dispositivos.",
    label: "REVOCAR SESIONES",
  },
  promote: {
    title: "Promover a administrador",
    action: "Asignar autoridad administrativa",
    consequence:
      "Cambiará el rol de la cuenta y se revocarán o actualizarán sus sesiones anteriores.",
    label: "PROMOVER",
  },
};

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ sortBy: "createdAt", sortOrder: "desc" });
  const [activeAction, setActiveAction] = useState(null);
  const params = useMemo(
    () => ({
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      search: debouncedSearch,
      status,
      ...sort,
    }),
    [debouncedSearch, page, sort, status],
  );
  const query = useQuery({
    queryKey: adminQueryKeys.users(params),
    queryFn: ({ signal }) => adminService.users.list(params, signal),
  });

  async function completeAction(values) {
    const id = resourceId(activeAction.row);
    const methods = {
      suspend: adminService.users.suspend,
      reactivate: adminService.users.reactivate,
      delete: adminService.users.remove,
      revoke: adminService.users.revokeSessions,
      promote: adminService.users.promote,
    };
    await methods[activeAction.kind](id, values);
    await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    await queryClient.invalidateQueries({
      queryKey: ["admin", "administrators"],
    });
  }

  const columns = [
    {
      key: "username",
      header: "Usuario",
      sortable: true,
      render: (row) => (
        <div>
          <Link
            className="font-semibold underline"
            href={adminRoutes.user(resourceId(row))}
          >
            {row.username}
          </Link>
          <span className="mt-1 block text-xs text-[var(--foreground-secondary)]">
            {row.displayName || "Sin nombre visible"}
          </span>
        </div>
      ),
    },
    { key: "email", header: "Correo" },
    {
      key: "status",
      header: "Estado",
      render: (row) => <AdminStatusBadge status={row.status} />,
    },
    {
      key: "createdAt",
      header: "Registro",
      sortable: true,
      render: (row) => formatAdminDate(row.createdAt),
    },
    {
      key: "lastLoginAt",
      header: "Último acceso",
      sortable: true,
      render: (row) => formatAdminDate(row.lastLoginAt),
    },
    {
      key: "activity",
      header: "Actividad",
      render: (row) => (
        <span className="whitespace-nowrap font-mono text-xs">
          I:{row.incidentCount ?? row.counts?.incidents ?? 0} · P:
          {row.postCount ?? row.counts?.posts ?? 0} · C:
          {row.commentCount ?? row.counts?.comments ?? 0}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <PermissionGate any={[ADMIN_PERMISSIONS.USERS_SUSPEND]}>
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
          <PermissionGate any={[ADMIN_PERMISSIONS.SESSIONS_REVOKE]}>
            <button
              type="button"
              className={buttonClassName({ variant: "ghost" })}
              onClick={() => setActiveAction({ kind: "revoke", row })}
            >
              SESIONES
            </button>
          </PermissionGate>
          <PermissionGate any={[ADMIN_PERMISSIONS.ADMINS_PROMOTE]}>
            <button
              type="button"
              className={buttonClassName({ variant: "primary" })}
              onClick={() => setActiveAction({ kind: "promote", row })}
            >
              PROMOVER
            </button>
          </PermissionGate>
          <PermissionGate any={[ADMIN_PERMISSIONS.USERS_DELETE]}>
            <button
              type="button"
              className={buttonClassName({ variant: "danger" })}
              onClick={() => setActiveAction({ kind: "delete", row })}
            >
              ELIMINAR
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];
  const dialog = activeAction ? actionContent[activeAction.kind] : null;

  return (
    <>
      <AdminPageHeader
        eyebrow="ADMINISTRACIÓN · GESTIÓN DE CUENTAS"
        title="Gestionar usuarios"
        description="Consulta por separado usuarios normales y administradores. Los cambios de rol son exclusivos del superadmin."
      />
      <UserManagementTabs />
      <AdminFilters>
        <label className="grid gap-1 text-sm">
          <span className="technical-label">BUSCAR</span>
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
            <option value="deleted">Eliminados</option>
          </Select>
        </label>
      </AdminFilters>
      <AdminDataTable
        caption="Usuarios normales"
        columns={columns}
        rows={query.data?.items}
        rowKey={resourceId}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        pagination={query.data?.pagination}
        onPageChange={setPage}
        sort={sort}
        onSort={(next) => {
          setSort(next);
          setPage(1);
        }}
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
        confirmationText={dialog?.confirmationText}
        onClose={() => setActiveAction(null)}
        onConfirm={completeAction}
      />
    </>
  );
}
