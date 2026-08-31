"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { buttonClassName } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useCities, useIncidentTypes } from "@/features/map/hooks/useCatalogs";
import { adminRoutes } from "@/lib/navigation/admin-routes";
import { adminQueryKeys } from "@/lib/query/admin-query-keys";

import { adminService } from "../../services/admin.service";
import {
  DEFAULT_PAGE_SIZE,
  elapsedLabel,
  formatAdminDate,
  resourceId,
} from "../../shared/admin-data";
import { IncidentSourceBadge } from "./IncidentSourceBadge";

export function AdminIncidentsPage() {
  const cities = useCities();
  const incidentTypes = useIncidentTypes();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("pending");
  const [cityId, setCityId] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [duplicate, setDuplicate] = useState("");
  const [sort, setSort] = useState({ sortBy: "createdAt", sortOrder: "asc" });
  const params = useMemo(
    () => ({
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      status,
      cityId,
      incidentType,
      source: sourceFilter,
      possibleDuplicate: duplicate,
      ...sort,
    }),
    [cityId, duplicate, incidentType, page, sort, sourceFilter, status],
  );
  const query = useQuery({
    queryKey: adminQueryKeys.incidents(params),
    queryFn: ({ signal }) => adminService.incidents.list(params, signal),
  });

  const columns = [
    {
      key: "id",
      header: "ID / título",
      render: (row) => (
        <div className="max-w-xs">
          <Link
            className="font-semibold underline"
            href={adminRoutes.incident(resourceId(row))}
          >
            {row.title || "Incidente sin título"}
          </Link>
          {row.submissionSource === "ai_scraper" ? (
            <div className="mt-2">
              <IncidentSourceBadge submissionSource={row.submissionSource} />
            </div>
          ) : null}
          <span className="mt-1 block break-all font-mono text-[0.62rem]">
            {resourceId(row)}
          </span>
        </div>
      ),
    },
    {
      key: "incidentType",
      header: "Tipo",
      render: (row) => row.incidentType?.name || row.incidentType,
    },
    {
      key: "location",
      header: "Zona",
      render: (row) => (
        <span>
          {row.city?.name || row.cityName || "—"}
          <span className="block text-xs text-[var(--foreground-secondary)]">
            {row.neighborhood || "Sin barrio"}
          </span>
        </span>
      ),
    },
    {
      key: "occurredAt",
      header: "Incidente",
      sortable: true,
      render: (row) => formatAdminDate(row.occurredAt),
    },
    {
      key: "createdAt",
      header: "Espera",
      sortable: true,
      render: (row) => (
        <span>
          {elapsedLabel(row.createdAt)}
          <span className="block text-xs text-[var(--foreground-secondary)]">
            {formatAdminDate(row.createdAt)}
          </span>
        </span>
      ),
    },
    {
      key: "evidence",
      header: "Evidencia",
      render: (row) => (
        <span className="font-mono text-xs">
          R:{row.reportCount ?? row.counts?.reports ?? 0} · C:
          {row.confirmationCount ?? row.counts?.confirmations ?? 0} · F:
          {(row.sourceUrls || row.sources || []).length}
        </span>
      ),
    },
    {
      key: "priority",
      header: "Prioridad",
      render: (row) => <AdminStatusBadge status={row.priority || row.status} />,
    },
    {
      key: "actions",
      header: "Revisión",
      render: (row) => (
        <Link
          href={adminRoutes.incident(resourceId(row))}
          className={buttonClassName({ variant: "secondary" })}
        >
          REVISAR
        </Link>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        eyebrow="MODERACIÓN · COLA DE INCIDENTES"
        title="Incidentes pendientes"
        description="La cola inicia obligatoriamente por los registros más antiguos. Los filtros y el orden se ejecutan en el backend."
      />
      <AdminFilters>
        <label className="grid gap-1 text-sm" htmlFor="admin-incident-city">
          <span className="technical-label">CIUDAD PRINCIPAL</span>
          <Select
            id="admin-incident-city"
            value={cityId}
            disabled={cities.isPending || cities.isError}
            onChange={(event) => {
              setCityId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">
              {cities.isPending ? "Cargando ciudades…" : "Todas las ciudades"}
            </option>
            {cities.data?.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-sm" htmlFor="admin-incident-type">
          <span className="technical-label">TIPO</span>
          <Select
            id="admin-incident-type"
            value={incidentType}
            disabled={incidentTypes.isPending || incidentTypes.isError}
            onChange={(event) => {
              setIncidentType(event.target.value);
              setPage(1);
            }}
          >
            <option value="">
              {incidentTypes.isPending ? "Cargando tipos…" : "Todos los tipos"}
            </option>
            {incidentTypes.data?.map((type) => (
              <option key={type.code} value={type.code}>
                {type.name}
              </option>
            ))}
          </Select>
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
            <option value="pending">Pendientes</option>
            <option value="admin_verified">Validados por administración</option>
            <option value="community_confirmed">Validados por comunidad</option>
            <option value="rejected">Rechazados</option>
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="technical-label">FUENTE</span>
          <Select
            value={sourceFilter}
            onChange={(event) => {
              setSourceFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Con o sin fuente</option>
            <option value="with">Con fuente</option>
            <option value="without">Sin fuente</option>
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="technical-label">DUPLICADO</span>
          <Select
            value={duplicate}
            onChange={(event) => {
              setDuplicate(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="true">Posible duplicado</option>
            <option value="false">Sin coincidencia</option>
          </Select>
        </label>
      </AdminFilters>
      <AdminDataTable
        caption="Cola de incidentes"
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
    </>
  );
}
