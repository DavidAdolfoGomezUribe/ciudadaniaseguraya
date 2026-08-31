"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, CircleAlert, Radio, ShieldCheck, Users } from "lucide-react";

import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { SystemPanel } from "@/components/ui/SystemPanel";
import { adminQueryKeys } from "@/lib/query/admin-query-keys";

import { adminService } from "../../services/admin.service";
import { formatAdminDate, resourceId } from "../../shared/admin-data";

const summaryCards = [
  ["pendingIncidents", "Incidentes pendientes", CircleAlert],
  ["approvedToday", "Aprobados hoy", ShieldCheck],
  ["rejectedToday", "Rechazados hoy", CircleAlert],
  ["activeUsers", "Usuarios activos", Users],
  ["suspendedUsers", "Usuarios suspendidos", Users],
  ["activeAdministrators", "Administradores activos", ShieldCheck],
  ["pendingRequests", "Solicitudes admin", Activity],
  ["reportedComments", "Comentarios reportados", Activity],
  ["pendingPosts", "Publicaciones pendientes", Activity],
];

export function AdminDashboard() {
  const query = useQuery({
    queryKey: adminQueryKeys.dashboard,
    queryFn: ({ signal }) => adminService.dashboard.get(signal),
  });
  const data = query.data || {};
  const summary = data.counts || {};
  const activity = data.recentAudit || [];
  const oldest = data.oldestPending || [];
  const services = data.services || {};

  return (
    <>
      <AdminPageHeader
        eyebrow="ADMINISTRACIÓN · RESUMEN OPERATIVO"
        title="Panel de control"
        description="Indicadores de moderación, estado de servicios y actividad administrativa reciente."
      />

      {query.isError ? (
        <AdminDataTable
          caption="Error de dashboard"
          columns={[]}
          error={query.error}
          onRetry={() => query.refetch()}
        />
      ) : (
        <>
          <section
            aria-label="Indicadores administrativos"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
          >
            {summaryCards.map(([key, label, Icon]) => (
              <SystemPanel key={key} className="p-4">
                <div className="mb-4 flex items-center justify-between">
                  <span className="technical-label">{label}</span>
                  <Icon size={17} aria-hidden="true" />
                </div>
                <p className="mb-0 font-mono text-3xl tabular-nums">
                  {query.isLoading
                    ? "—"
                    : Number(summary?.[key] || 0).toLocaleString("es-CO")}
                </p>
              </SystemPanel>
            ))}
          </section>

          <section className="mt-6 grid gap-5 xl:grid-cols-2">
            <div>
              <h2 className="technical-label mb-3">
                INCIDENTES PENDIENTES MÁS ANTIGUOS
              </h2>
              <AdminDataTable
                caption="Incidentes pendientes más antiguos"
                loading={query.isLoading}
                rows={oldest}
                rowKey={resourceId}
                columns={[
                  { key: "title", header: "Título" },
                  {
                    key: "createdAt",
                    header: "Reportado",
                    render: (row) => formatAdminDate(row.createdAt),
                  },
                  {
                    key: "status",
                    header: "Estado",
                    render: (row) => <AdminStatusBadge status={row.status} />,
                  },
                ]}
              />
            </div>
            <div>
              <h2 className="technical-label mb-3">
                ACTIVIDAD ADMINISTRATIVA RECIENTE
              </h2>
              <AdminDataTable
                caption="Actividad administrativa reciente"
                loading={query.isLoading}
                rows={activity}
                rowKey={(row) => resourceId(row) || `${row.action}-${row.createdAt}`}
                columns={[
                  { key: "action", header: "Acción" },
                  {
                    key: "actor",
                    header: "Actor",
                    render: (row) =>
                      row.actor?.username || row.actorUsername || "Sistema",
                  },
                  {
                    key: "createdAt",
                    header: "Fecha",
                    render: (row) => formatAdminDate(row.createdAt),
                  },
                ]}
              />
            </div>
          </section>

          <section className="mt-6 grid gap-3 sm:grid-cols-2">
            <SystemPanel className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="technical-label mb-1">ESTADO DEL BACKEND</p>
                <p className="mb-0 text-sm">
                  {services.backend === "available"
                    ? "Operativo"
                    : "Servicio no disponible"}
                </p>
              </div>
              <AdminStatusBadge
                status={services.backend === "available" ? "active" : "unavailable"}
              />
            </SystemPanel>
            <SystemPanel className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="technical-label mb-1">CANAL EN TIEMPO REAL</p>
                <p className="mb-0 flex items-center gap-2 text-sm">
                  <Radio size={15} aria-hidden="true" /> Canal administrativo protegido
                </p>
              </div>
              <AdminStatusBadge
                status={services.realtime === "available" ? "active" : "unavailable"}
              />
            </SystemPanel>
          </section>
        </>
      )}
    </>
  );
}
