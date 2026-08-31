"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";

import { AdminDataTable } from "@/components/admin/AdminDataTable";
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
import { formatAdminDate, resourceId } from "../../shared/admin-data";
import { IncidentSourceBadge } from "./IncidentSourceBadge";

const AdminIncidentLocationMap = dynamic(() => import("./AdminIncidentLocationMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-80 place-items-center border border-[var(--border-primary)]">
      <p className="technical-label pulse-dot">CARGANDO MAPA DE REVISIÓN</p>
    </div>
  ),
});

const rejectionReasons = [
  ["insufficient_evidence", "Evidencia insuficiente"],
  ["duplicate", "Duplicado"],
  ["incorrect_location", "Ubicación incorrecta"],
  ["incorrect_date", "Fecha incorrecta"],
  ["false_information", "Información falsa"],
  ["outside_supported_area", "Fuera del área soportada"],
  ["prohibited_content", "Contenido prohibido"],
  ["other", "Otro"],
].map(([value, label]) => ({ value, label }));

export function AdminIncidentDetail({ incidentId }) {
  const queryClient = useQueryClient();
  const [activeAction, setActiveAction] = useState(null);
  const [mergeTarget, setMergeTarget] = useState("");
  const [editReason, setEditReason] = useState("");
  const query = useQuery({
    queryKey: adminQueryKeys.incident(incidentId),
    queryFn: ({ signal }) => adminService.incidents.detail(incidentId, signal),
  });
  const mergeCandidateId = mergeTarget.trim();
  const mergeCandidateQuery = useQuery({
    queryKey: adminQueryKeys.incident(mergeCandidateId || "merge-candidate"),
    queryFn: ({ signal }) => adminService.incidents.detail(mergeCandidateId, signal),
    enabled: Boolean(mergeCandidateId && mergeCandidateId !== incidentId),
  });
  const updateMutation = useMutation({
    mutationFn: (body) => adminService.incidents.update(incidentId, body),
    onSuccess: async () => {
      setEditReason("");
      await queryClient.invalidateQueries({
        queryKey: adminQueryKeys.incident(incidentId),
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "incidents"] });
    },
  });
  const lockMutation = useMutation({
    mutationFn: ({ release, expectedUpdatedAt }) =>
      release
        ? adminService.incidents.releaseReview(incidentId, {
            expectedUpdatedAt,
          })
        : adminService.incidents.claimReview(incidentId, {
            expectedUpdatedAt,
            ttlSeconds: 900,
          }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: adminQueryKeys.incident(incidentId),
      });
    },
  });

  async function completeAction(values) {
    if (activeAction === "approve") {
      await adminService.incidents.approve(incidentId, {
        ...values,
        sourceUrls: incident.sourceUrls || incident.sources || [],
        corrections: {},
        expectedUpdatedAt: incident.updatedAt,
      });
    }
    if (activeAction === "reject") {
      await adminService.incidents.reject(incidentId, {
        ...values,
        expectedUpdatedAt: incident.updatedAt,
      });
    }
    if (activeAction === "merge") {
      await adminService.incidents.merge(incidentId, {
        ...values,
        secondaryIncidentId: mergeCandidateId,
        expectedUpdatedAt: incident.updatedAt,
        secondaryExpectedUpdatedAt: mergeCandidateQuery.data.updatedAt,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ["admin", "incidents"] });
    await queryClient.invalidateQueries({
      queryKey: adminQueryKeys.incident(incidentId),
    });
  }

  if (query.isLoading) {
    return <p className="technical-label pulse-dot">CARGANDO EXPEDIENTE</p>;
  }
  if (query.isError) return <SubmitStatus error={query.error} />;
  const incident = query.data;
  const location = incident.location?.coordinates || [];
  const longitude = location[0] ?? incident.longitude;
  const latitude = location[1] ?? incident.latitude;
  const verificationMethod =
    incident.verification?.method || incident.validationMethod || "pending";

  return (
    <>
      <AdminPageHeader
        eyebrow="INCIDENTES · EXPEDIENTE DE REVISIÓN"
        title={incident.title}
        description={`ID ${incidentId} · Actualizado ${formatAdminDate(incident.updatedAt)}`}
        actions={
          <>
            <ButtonLink variant="secondary" href={adminRoutes.incidents}>
              VOLVER A LA COLA
            </ButtonLink>
            <PermissionGate any={[ADMIN_PERMISSIONS.INCIDENTS_APPROVE]}>
              <Button onClick={() => setActiveAction("approve")}>APROBAR</Button>
            </PermissionGate>
            <PermissionGate any={[ADMIN_PERMISSIONS.INCIDENTS_REJECT]}>
              <Button variant="danger" onClick={() => setActiveAction("reject")}>
                RECHAZAR
              </Button>
            </PermissionGate>
          </>
        }
      />

      {incident.reviewLock ? (
        <div className="mb-5 border-l-4 border-[var(--accent-information)] bg-[var(--surface-information)] p-4 text-sm">
          <p className="technical-label mb-1">BLOQUEO DE REVISIÓN</p>
          <p className="mb-0">
            {incident.reviewLock.reviewer?.username ||
              incident.reviewLock.lockedBy ||
              "Otro administrador"}{" "}
            revisa este incidente hasta {formatAdminDate(incident.reviewLock.expiresAt)}
            .
          </p>
          {incident.reviewLock.canRelease ? (
            <Button
              className="mt-3"
              variant="secondary"
              disabled={lockMutation.isPending}
              onClick={() =>
                lockMutation.mutate({
                  release: true,
                  expectedUpdatedAt: incident.updatedAt,
                })
              }
            >
              LIBERAR BLOQUEO
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mb-5 border-l-4 border-[var(--accent-success)] bg-[var(--surface-success)] p-4 text-sm">
          <p className="technical-label mb-1">REVISIÓN DISPONIBLE</p>
          <p>Reclama temporalmente el expediente antes de modificarlo.</p>
          <Button
            disabled={lockMutation.isPending}
            onClick={() =>
              lockMutation.mutate({
                release: false,
                expectedUpdatedAt: incident.updatedAt,
              })
            }
          >
            {lockMutation.isPending ? "RECLAMANDO" : "RECLAMAR REVISIÓN"}
          </Button>
          <SubmitStatus error={lockMutation.error} />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <div className="grid gap-5">
          <SystemPanel className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <AdminStatusBadge status={incident.status} />
              <IncidentSourceBadge submissionSource={incident.submissionSource} />
              {verificationMethod === "admin" ||
              verificationMethod === "administrative" ? (
                <AdminStatusBadge status="approved">
                  VALIDADO POR ADMINISTRACIÓN
                </AdminStatusBadge>
              ) : verificationMethod === "community" ? (
                <AdminStatusBadge status="active">
                  VALIDADO POR LA COMUNIDAD
                </AdminStatusBadge>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap leading-7">{incident.description}</p>
            <dl className="grid gap-4 border-t border-[var(--border-soft)] pt-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["TIPO", incident.incidentType?.name || incident.incidentType],
                ["FECHA DEL HECHO", formatAdminDate(incident.occurredAt)],
                ["REPORTADO", formatAdminDate(incident.createdAt)],
                ["CIUDAD", incident.city?.name || incident.cityName],
                ["BARRIO", incident.neighborhood],
                ["DIRECCIÓN", incident.address],
                ["MÉTODO DE UBICACIÓN", incident.locationPrecision],
                [
                  "UBICACIÓN CONFIRMADA",
                  incident.locationConfirmed === true ? "SÍ" : null,
                ],
                ["H3", incident.h3Index],
                [
                  "REPORTANTE",
                  incident.reporter?.anonymousLabel ||
                    incident.reporterAnonymized ||
                    "Identidad minimizada",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="technical-label">{label}</dt>
                  <dd className="mt-1 break-words">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </SystemPanel>
          <SystemPanel className="overflow-hidden p-3">
            <p className="technical-label mb-3 px-2">UBICACIÓN CARTOGRÁFICA</p>
            <AdminIncidentLocationMap
              latitude={latitude}
              longitude={longitude}
              h3Index={incident.h3Index}
            />
          </SystemPanel>
          <SystemPanel className="p-5">
            <h2 className="text-xl">Evidencia y relaciones</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="technical-label">FUENTES EXTERNAS</p>
                <ul className="pl-5 text-sm">
                  {(incident.sourceUrls || incident.sources || []).map((source) => (
                    <li key={typeof source === "string" ? source : source.url}>
                      <a
                        href={typeof source === "string" ? source : source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all underline"
                      >
                        {typeof source === "string"
                          ? source
                          : source.label || source.url}
                      </a>
                    </li>
                  ))}
                </ul>
                {incident.evidenceDescription ? (
                  <div className="mt-4">
                    <p className="technical-label">DESCRIPCIÓN DE EVIDENCIA</p>
                    <p className="whitespace-pre-wrap text-sm">
                      {incident.evidenceDescription}
                    </p>
                  </div>
                ) : null}
              </div>
              <div>
                <p className="technical-label">ESTADÍSTICAS DE LA ZONA</p>
                <pre className="overflow-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(incident.zoneStatistics || {}, null, 2)}
                </pre>
              </div>
            </div>
          </SystemPanel>
          <div>
            <h2 className="technical-label mb-3">POSIBLES DUPLICADOS</h2>
            <AdminDataTable
              caption="Posibles duplicados"
              rows={incident.possibleDuplicates || []}
              rowKey={resourceId}
              columns={[
                { key: "title", header: "Título" },
                {
                  key: "occurredAt",
                  header: "Fecha",
                  render: (row) => formatAdminDate(row.occurredAt),
                },
                { key: "similarity", header: "Similitud" },
              ]}
            />
          </div>
          <div>
            <h2 className="technical-label mb-3">HISTORIAL DE CAMBIOS</h2>
            <AdminDataTable
              caption="Historial del incidente"
              rows={incident.history || []}
              rowKey={(row) => resourceId(row) || `${row.action}-${row.createdAt}`}
              columns={[
                { key: "action", header: "Acción" },
                {
                  key: "actor",
                  header: "Actor",
                  render: (row) => row.actor?.username || row.actorRole || "Sistema",
                },
                {
                  key: "createdAt",
                  header: "Fecha",
                  render: (row) => formatAdminDate(row.createdAt),
                },
              ]}
            />
          </div>
        </div>

        <aside className="grid content-start gap-5">
          <PermissionGate any={[ADMIN_PERMISSIONS.INCIDENTS_UPDATE]}>
            <SystemPanel className="p-5">
              <h2 className="text-xl">Corregir información</h2>
              <form
                key={incident.updatedAt}
                className="grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const values = new FormData(event.currentTarget);
                  const occurredAt = String(values.get("occurredAt") || "");
                  updateMutation.mutate({
                    title: String(values.get("title") || "").trim(),
                    description: String(values.get("description") || "").trim(),
                    neighborhood: String(values.get("neighborhood") || "").trim(),
                    address: String(values.get("address") || "").trim(),
                    ...(occurredAt
                      ? { occurredAt: new Date(occurredAt).toISOString() }
                      : {}),
                    latitude: Number(values.get("latitude")),
                    longitude: Number(values.get("longitude")),
                    reason: editReason.trim(),
                    expectedUpdatedAt: incident.updatedAt,
                  });
                }}
              >
                <FormField label="Título" htmlFor="incident-title" required>
                  <Input
                    id="incident-title"
                    name="title"
                    defaultValue={incident.title}
                    minLength={5}
                    maxLength={120}
                    required
                  />
                </FormField>
                <FormField label="Descripción" htmlFor="incident-description" required>
                  <textarea
                    id="incident-description"
                    name="description"
                    rows={5}
                    minLength={10}
                    maxLength={2000}
                    defaultValue={incident.description}
                    required
                    className="w-full border border-[var(--border-primary)] bg-[var(--background-elevated)] p-3"
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Barrio" htmlFor="incident-neighborhood">
                    <Input
                      id="incident-neighborhood"
                      name="neighborhood"
                      maxLength={100}
                      defaultValue={incident.neighborhood}
                    />
                  </FormField>
                  <FormField label="Dirección" htmlFor="incident-address">
                    <Input
                      id="incident-address"
                      name="address"
                      maxLength={200}
                      defaultValue={incident.address}
                    />
                  </FormField>
                  <FormField label="Latitud" htmlFor="incident-latitude">
                    <Input
                      id="incident-latitude"
                      name="latitude"
                      type="number"
                      step="any"
                      defaultValue={latitude}
                    />
                  </FormField>
                  <FormField label="Longitud" htmlFor="incident-longitude">
                    <Input
                      id="incident-longitude"
                      name="longitude"
                      type="number"
                      step="any"
                      defaultValue={longitude}
                    />
                  </FormField>
                </div>
                <FormField label="Fecha y hora" htmlFor="incident-occurred-at">
                  <Input
                    id="incident-occurred-at"
                    name="occurredAt"
                    type="datetime-local"
                    defaultValue={
                      incident.occurredAt
                        ? new Date(incident.occurredAt).toISOString().slice(0, 16)
                        : ""
                    }
                  />
                </FormField>
                <FormField label="Motivo" htmlFor="incident-edit-reason" required>
                  <textarea
                    id="incident-edit-reason"
                    rows={3}
                    value={editReason}
                    onChange={(event) => setEditReason(event.target.value)}
                    className="w-full border border-[var(--border-primary)] bg-[var(--background-elevated)] p-3"
                  />
                </FormField>
                {updateMutation.error?.status === 409 ? (
                  <div className="border-l-4 border-[var(--accent-warning)] bg-[var(--surface-warning)] p-3 text-sm">
                    El incidente fue actualizado por otro administrador. Recarga la
                    información antes de continuar.
                  </div>
                ) : null}
                <SubmitStatus
                  error={updateMutation.error}
                  success={
                    updateMutation.isSuccess
                      ? "Correcciones guardadas y auditadas."
                      : null
                  }
                />
                <Button
                  type="submit"
                  disabled={updateMutation.isPending || editReason.trim().length < 10}
                >
                  {updateMutation.isPending ? "GUARDANDO" : "GUARDAR CORRECCIONES"}
                </Button>
              </form>
            </SystemPanel>
          </PermissionGate>

          <PermissionGate any={[ADMIN_PERMISSIONS.INCIDENTS_MERGE]}>
            <SystemPanel className="p-5">
              <h2 className="text-xl">Fusionar duplicado</h2>
              <FormField
                label="ID del incidente duplicado"
                htmlFor="merge-secondary-incident"
                hint="El expediente actual será el principal; el ID indicado se archivará como duplicado."
              >
                <Input
                  id="merge-secondary-incident"
                  value={mergeTarget}
                  onChange={(event) => setMergeTarget(event.target.value)}
                />
              </FormField>
              {mergeCandidateId === incidentId ? (
                <p className="mt-3 text-sm text-[var(--accent-danger)]">
                  El incidente duplicado debe ser diferente del principal.
                </p>
              ) : mergeCandidateQuery.isFetching ? (
                <p className="technical-label mt-3 pulse-dot">
                  VALIDANDO INCIDENTE DUPLICADO
                </p>
              ) : mergeCandidateQuery.isError ? (
                <SubmitStatus error={mergeCandidateQuery.error} />
              ) : null}
              <Button
                className="mt-4"
                variant="danger"
                disabled={
                  !mergeCandidateId ||
                  mergeCandidateId === incidentId ||
                  !mergeCandidateQuery.isSuccess
                }
                onClick={() => setActiveAction("merge")}
              >
                PREPARAR FUSIÓN
              </Button>
            </SystemPanel>
          </PermissionGate>
        </aside>
      </div>

      <ConfirmationDialog
        open={Boolean(activeAction)}
        title={
          activeAction === "approve"
            ? "Aprobar incidente"
            : activeAction === "reject"
              ? "Rechazar incidente"
              : "Fusionar incidente duplicado"
        }
        action={
          activeAction === "approve"
            ? "Validar administrativamente el incidente"
            : activeAction === "reject"
              ? "Rechazar el incidente"
              : "Consolidar el incidente en el registro principal"
        }
        resource={`${incident.title} · ${incidentId}`}
        consequence={
          activeAction === "approve"
            ? "Se actualizarán el mapa, los agregados H3 y el canal en tiempo real una sola vez."
            : activeAction === "reject"
              ? "No se incrementarán las estadísticas y se notificará el cambio."
              : `El duplicado se archivará y sus relaciones pasarán a ${mergeTarget}.`
        }
        reasonCodes={activeAction === "reject" ? rejectionReasons : undefined}
        confirmLabel={
          activeAction === "approve"
            ? "APROBAR INCIDENTE"
            : activeAction === "reject"
              ? "RECHAZAR INCIDENTE"
              : "FUSIONAR INCIDENTES"
        }
        confirmVariant={activeAction === "approve" ? "primary" : "danger"}
        onClose={() => setActiveAction(null)}
        onConfirm={completeAction}
      />
    </>
  );
}
