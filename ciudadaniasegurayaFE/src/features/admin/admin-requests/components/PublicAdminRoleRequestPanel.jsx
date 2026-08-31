"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { FormField } from "@/components/forms/FormField";
import { SubmitStatus } from "@/components/forms/SubmitStatus";
import { Button } from "@/components/ui/Button";
import { SystemPanel } from "@/components/ui/SystemPanel";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { apiRequest } from "@/lib/api/api-client";
import { endpoints } from "@/lib/api/endpoints";

async function getMyRequest() {
  const result = await apiRequest(endpoints.adminRoleRequests.mine);
  const data = result.data;
  if (Array.isArray(data)) {
    return data.find((request) => request.status === "pending") || data[0] || null;
  }
  return data?.request || data || null;
}

export function PublicAdminRoleRequestPanel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const eligible = ["user", "citizen"].includes(user?.role);
  const query = useQuery({
    queryKey: ["account", "admin-role-request"],
    queryFn: getMyRequest,
    enabled: eligible,
    retry: false,
  });
  const create = useMutation({
    mutationFn: async (body) => {
      const result = await apiRequest(endpoints.adminRoleRequests.create, {
        method: "POST",
        body,
      });
      return result.data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["account", "admin-role-request"] }),
  });
  const cancel = useMutation({
    mutationFn: async (requestId) =>
      apiRequest(endpoints.adminRoleRequests.cancel(requestId), {
        method: "DELETE",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["account", "admin-role-request"] }),
  });

  if (!eligible) return null;
  const request = query.data;
  const requestId = request?.id || request?._id;

  return (
    <SystemPanel className="mt-6 max-w-2xl p-6">
      <p className="technical-label">PARTICIPACIÓN · ROL ADMINISTRATIVO</p>
      <h2 className="mt-2 text-2xl">Solicitud para apoyar la moderación</h2>
      <p className="text-sm text-[var(--foreground-secondary)]">
        La solicitud no concede permisos automáticamente. Un superadmin revisará la
        motivación, experiencia y actividad de la cuenta.
      </p>
      {query.isLoading ? (
        <p className="technical-label pulse-dot">CONSULTANDO SOLICITUD</p>
      ) : request ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <AdminStatusBadge status={request.status} />
            <span className="text-sm">
              Creada {new Date(request.createdAt).toLocaleDateString("es-CO")}
            </span>
          </div>
          {request.resolutionReason ? (
            <p className="border-l-4 border-[var(--border-primary)] pl-3 text-sm">
              {request.resolutionReason}
            </p>
          ) : null}
          {request.status === "pending" ? (
            <Button
              variant="danger"
              className="justify-self-start"
              onClick={() => setConfirmCancel(true)}
            >
              CANCELAR SOLICITUD
            </Button>
          ) : null}
        </div>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const experience = String(data.get("experience") || "").trim();
            create.mutate({
              motivation: String(data.get("motivation") || "").trim(),
              ...(experience ? { experience } : {}),
            });
          }}
        >
          <FormField label="Experiencia relevante" htmlFor="admin-request-experience">
            <textarea
              id="admin-request-experience"
              name="experience"
              rows={4}
              maxLength={2000}
              className="w-full border border-[var(--border-primary)] bg-[var(--background-elevated)] p-3"
            />
          </FormField>
          <FormField label="Motivación" htmlFor="admin-request-motivation" required>
            <textarea
              id="admin-request-motivation"
              name="motivation"
              rows={5}
              minLength={30}
              maxLength={2000}
              required
              className="w-full border border-[var(--border-primary)] bg-[var(--background-elevated)] p-3"
            />
          </FormField>
          <SubmitStatus
            error={create.error || query.error}
            success={create.isSuccess ? "Solicitud registrada." : null}
          />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "ENVIANDO" : "ENVIAR SOLICITUD"}
          </Button>
        </form>
      )}
      <ConfirmationDialog
        open={confirmCancel && Boolean(requestId)}
        title="Cancelar solicitud administrativa"
        action="Cancelar la solicitud pendiente"
        resource={requestId || ""}
        consequence="La solicitud dejará de estar disponible para resolución."
        confirmLabel="CANCELAR SOLICITUD"
        requireReason={false}
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => {
          await cancel.mutateAsync(requestId);
          setConfirmCancel(false);
        }}
      />
    </SystemPanel>
  );
}
