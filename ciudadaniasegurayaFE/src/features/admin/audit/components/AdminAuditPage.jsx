"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AuditDetails } from "@/components/admin/AuditDetails";
import { buttonClassName } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SystemPanel } from "@/components/ui/SystemPanel";
import { adminQueryKeys } from "@/lib/query/admin-query-keys";

import { adminService } from "../../services/admin.service";
import {
  DEFAULT_PAGE_SIZE,
  formatAdminDate,
  resourceId,
} from "../../shared/admin-data";

export function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    actorUserId: "",
    role: "",
    action: "",
    resourceType: "",
    requestId: "",
    from: "",
    to: "",
  });
  const [selectedLog, setSelectedLog] = useState(null);
  const params = useMemo(
    () => ({
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      ...filters,
    }),
    [filters, page],
  );
  const query = useQuery({
    queryKey: adminQueryKeys.audit(params),
    queryFn: ({ signal }) => adminService.audit.list(params, signal),
  });

  function filterField(key, label, input) {
    return (
      <label className="grid gap-1 text-sm">
        <span className="technical-label">{label}</span>
        {input || (
          <Input
            value={filters[key]}
            onChange={(event) => {
              setFilters((value) => ({ ...value, [key]: event.target.value }));
              setPage(1);
            }}
          />
        )}
      </label>
    );
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="SEGURIDAD · REGISTRO INMUTABLE"
        title="Auditoría"
        description="Consulta acciones administrativas permitidas por tu alcance. Los registros no pueden editarse ni eliminarse."
      />
      <AdminFilters>
        {filterField("actorUserId", "ID DEL ADMINISTRADOR")}
        {filterField(
          "role",
          "ROL",
          <Select
            value={filters.role}
            onChange={(event) => {
              setFilters((value) => ({ ...value, role: event.target.value }));
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </Select>,
        )}
        {filterField("action", "ACCIÓN")}
        {filterField("resourceType", "RECURSO")}
        {filterField("requestId", "REQUEST ID")}
        {filterField(
          "from",
          "DESDE",
          <Input
            type="date"
            value={filters.from}
            onChange={(event) => {
              setFilters((value) => ({ ...value, from: event.target.value }));
              setPage(1);
            }}
          />,
        )}
        {filterField(
          "to",
          "HASTA",
          <Input
            type="date"
            value={filters.to}
            onChange={(event) => {
              setFilters((value) => ({ ...value, to: event.target.value }));
              setPage(1);
            }}
          />,
        )}
      </AdminFilters>
      <AdminDataTable
        caption="Registros de auditoría"
        rows={query.data?.items}
        rowKey={resourceId}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        pagination={query.data?.pagination}
        onPageChange={setPage}
        columns={[
          {
            key: "createdAt",
            header: "Fecha",
            render: (row) => formatAdminDate(row.createdAt),
          },
          {
            key: "actor",
            header: "Actor",
            render: (row) => row.actor?.username || row.actorUsername || "Sistema",
          },
          { key: "actorRole", header: "Rol" },
          { key: "action", header: "Acción" },
          {
            key: "resource",
            header: "Recurso",
            render: (row) => `${row.resourceType || "—"} · ${row.resourceId || "—"}`,
          },
          { key: "reason", header: "Motivo" },
          {
            key: "requestId",
            header: "Request ID",
            render: (row) => (
              <span className="break-all font-mono text-xs">
                {row.requestId || "—"}
              </span>
            ),
          },
          {
            key: "details",
            header: "Cambios",
            render: (row) => (
              <button
                type="button"
                className={buttonClassName({ variant: "secondary" })}
                onClick={() => setSelectedLog(row)}
              >
                VER RESUMEN
              </button>
            ),
          },
        ]}
      />
      {selectedLog ? (
        <SystemPanel className="mt-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="technical-label mb-1">DETALLE DE CAMBIOS</p>
              <h2 className="mb-0 text-xl">{selectedLog.action}</h2>
            </div>
            <button
              type="button"
              className={buttonClassName({ variant: "ghost" })}
              onClick={() => setSelectedLog(null)}
            >
              CERRAR
            </button>
          </div>
          <AuditDetails log={selectedLog} />
        </SystemPanel>
      ) : null}
    </>
  );
}
