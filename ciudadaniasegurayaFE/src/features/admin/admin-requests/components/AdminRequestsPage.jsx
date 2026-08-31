"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminFilters } from "@/components/admin/AdminFilters";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { FormField } from "@/components/forms/FormField";
import { SubmitStatus } from "@/components/forms/SubmitStatus";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SystemPanel } from "@/components/ui/SystemPanel";
import { useAdminSession } from "@/features/admin/auth/components/AdminSessionProvider";
import { ADMIN_PERMISSIONS } from "@/features/admin/permissions/admin-permissions";
import { adminQueryKeys } from "@/lib/query/admin-query-keys";

import { adminService } from "../../services/admin.service";
import {
  DEFAULT_PAGE_SIZE,
  formatAdminDate,
  resourceId,
} from "../../shared/admin-data";

export function AdminRequestsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAdminSession();
  const canResolve = hasPermission(ADMIN_PERMISSIONS.ADMIN_REQUESTS_RESOLVE);
  const canCreate = hasPermission(ADMIN_PERMISSIONS.ADMIN_REQUESTS_CREATE);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const params = useMemo(
    () => ({
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      status,
      sortOrder: "asc",
    }),
    [page, status],
  );
  const query = useQuery({
    queryKey: adminQueryKeys.adminRequests(canResolve ? "all" : "mine", params),
    queryFn: ({ signal }) =>
      canResolve
        ? adminService.adminRequests.list(params, signal)
        : adminService.adminRequests.mine(params, signal),
  });
  const createMutation = useMutation({
    mutationFn: adminService.adminRequests.create,
    onSuccess: async () => {
      setShowRecommendation(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "admin-requests"] });
    },
  });

  async function resolveRequest(values) {
    const id = resourceId(activeAction.row);
    if (activeAction.kind === "approve") {
      await adminService.adminRequests.approve(id, values);
    } else if (activeAction.kind === "request-information") {
      await adminService.adminRequests.requestInformation(id, values);
    } else {
      await adminService.adminRequests.reject(id, values);
    }
    await queryClient.invalidateQueries({ queryKey: ["admin", "admin-requests"] });
  }

  const columns = [
    {
      key: "candidate",
      header: "Candidato",
      render: (row) =>
        row.candidate?.username || row.candidateUsername || row.candidateUserId || "—",
    },
    {
      key: "requestedBy",
      header: "Solicitado por",
      render: (row) =>
        row.requestedBy?.username || row.requestedByUsername || row.requestedByRole,
    },
    {
      key: "motivation",
      header: "Motivación",
      render: (row) => (
        <span className="block max-w-sm whitespace-normal">{row.motivation}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Fecha",
      render: (row) => formatAdminDate(row.createdAt),
    },
    {
      key: "status",
      header: "Estado",
      render: (row) => <AdminStatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "Resolución",
      render: (row) =>
        canResolve && row.status === "pending" ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={buttonClassName({ variant: "primary" })}
              onClick={() => setActiveAction({ kind: "approve", row })}
            >
              APROBAR Y PROMOVER
            </button>
            <button
              type="button"
              className={buttonClassName({ variant: "secondary" })}
              onClick={() => setActiveAction({ kind: "request-information", row })}
            >
              SOLICITAR MÁS INFORMACIÓN
            </button>
            <button
              type="button"
              className={buttonClassName({ variant: "danger" })}
              onClick={() => setActiveAction({ kind: "reject", row })}
            >
              RECHAZAR
            </button>
          </div>
        ) : (
          <span className="text-xs text-[var(--foreground-secondary)]">
            {row.resolutionReason || "Solo lectura"}
          </span>
        ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        eyebrow="ADMINISTRACIÓN · SOLICITUDES DE ROL"
        title="Solicitudes administrativas"
        description={
          canResolve
            ? "Revisa solicitudes de la más antigua a la más reciente. Cada decisión exige una razón."
            : "Consulta tus recomendaciones y su estado. La aprobación corresponde exclusivamente al superadmin."
        }
        actions={
          canCreate ? (
            <Button onClick={() => setShowRecommendation((value) => !value)}>
              {showRecommendation ? "CERRAR FORMULARIO" : "RECOMENDAR USUARIO"}
            </Button>
          ) : null
        }
      />
      {showRecommendation ? (
        <SystemPanel className="mb-5 p-5">
          <h2 className="text-xl">Nueva recomendación</h2>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              const experience = String(values.get("experience") || "").trim();
              createMutation.mutate({
                candidateUserId: String(values.get("candidateUserId") || "").trim(),
                motivation: String(values.get("motivation") || "").trim(),
                ...(experience ? { experience } : {}),
              });
            }}
          >
            <FormField
              label="ID del usuario candidato"
              htmlFor="candidate-user-id"
              required
            >
              <Input
                id="candidate-user-id"
                name="candidateUserId"
                minLength={1}
                required
              />
            </FormField>
            <FormField label="Experiencia (opcional)" htmlFor="candidate-experience">
              <Input id="candidate-experience" name="experience" maxLength={2000} />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Motivación" htmlFor="candidate-motivation" required>
                <textarea
                  id="candidate-motivation"
                  name="motivation"
                  rows={4}
                  minLength={30}
                  maxLength={2000}
                  required
                  className="w-full border border-[var(--border-primary)] bg-[var(--background-elevated)] p-3"
                />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <SubmitStatus
                error={createMutation.error}
                success={createMutation.isSuccess ? "Recomendación registrada." : null}
              />
              <Button
                className="mt-3"
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "REGISTRANDO" : "ENVIAR RECOMENDACIÓN"}
              </Button>
            </div>
          </form>
        </SystemPanel>
      ) : null}
      <AdminFilters>
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
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
            <option value="cancelled">Canceladas</option>
          </Select>
        </label>
      </AdminFilters>
      <AdminDataTable
        caption="Solicitudes administrativas"
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
        title={
          activeAction?.kind === "approve"
            ? "Aprobar y promover candidato"
            : activeAction?.kind === "request-information"
              ? "Solicitar más información"
              : "Rechazar solicitud"
        }
        action={
          activeAction?.kind === "approve"
            ? "Resolver la solicitud y promover al usuario"
            : activeAction?.kind === "request-information"
              ? "Pedir información adicional sin cerrar la solicitud"
              : "Rechazar la solicitud administrativa"
        }
        resource={activeAction ? resourceId(activeAction.row) : ""}
        consequence={
          activeAction?.kind === "approve"
            ? "La promoción y su auditoría se ejecutarán como una sola operación lógica."
            : activeAction?.kind === "request-information"
              ? "La solicitud continuará pendiente y la petición quedará registrada en su historial."
              : "La solicitud quedará cerrada con el motivo indicado."
        }
        confirmLabel={
          activeAction?.kind === "approve"
            ? "APROBAR Y PROMOVER"
            : activeAction?.kind === "request-information"
              ? "SOLICITAR INFORMACIÓN"
              : "RECHAZAR"
        }
        confirmVariant={
          activeAction?.kind === "approve"
            ? "primary"
            : activeAction?.kind === "request-information"
              ? "secondary"
              : "danger"
        }
        onClose={() => setActiveAction(null)}
        onConfirm={resolveRequest}
      />
    </>
  );
}
