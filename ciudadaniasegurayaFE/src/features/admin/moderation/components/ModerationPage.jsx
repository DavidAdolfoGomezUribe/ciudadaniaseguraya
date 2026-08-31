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
import { adminQueryKeys } from "@/lib/query/admin-query-keys";

import { adminService } from "../../services/admin.service";
import {
  DEFAULT_PAGE_SIZE,
  formatAdminDate,
  resourceId,
} from "../../shared/admin-data";
import { useDebouncedValue } from "../../shared/use-debounced-value";

const resourceConfig = {
  posts: {
    eyebrow: "MODERACIÓN · PUBLICACIONES",
    title: "Publicaciones",
    singular: "publicación",
    permissionDescription:
      "Oculta, restaura, corrige o elimina lógicamente publicaciones con trazabilidad completa.",
    contentKey: "content",
    searchPlaceholder: "Contenido, título o autor",
  },
  comments: {
    eyebrow: "MODERACIÓN · COMENTARIOS",
    title: "Comentarios",
    singular: "comentario",
    permissionDescription:
      "Revisa el contexto antes de editar, ocultar, restaurar o eliminar lógicamente un comentario.",
    contentKey: "content",
    searchPlaceholder: "Contenido del comentario",
  },
};

function ModerationEditor({ resource, item, onSaved }) {
  const config = resourceConfig[resource];
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: (body) => adminService[resource].update(resourceId(item), body),
    onSuccess: onSaved,
  });

  return (
    <SystemPanel className="p-5">
      <h2 className="text-xl">Edición con trazabilidad</h2>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const relatedIncidentId = String(
            values.get("relatedIncidentId") || "",
          ).trim();
          mutation.mutate({
            content: String(values.get("content") || "").trim(),
            ...(resource === "posts"
              ? {
                  title: String(values.get("title") || "").trim(),
                  relatedIncidentId: relatedIncidentId || null,
                }
              : {}),
            reason: reason.trim(),
          });
        }}
      >
        {resource === "posts" ? (
          <FormField label="Título" htmlFor="moderation-title" required>
            <Input
              id="moderation-title"
              name="title"
              minLength={5}
              maxLength={150}
              defaultValue={item.title}
              required
            />
          </FormField>
        ) : null}
        <FormField
          label={`Contenido del ${config.singular}`}
          htmlFor="moderation-content"
          required
        >
          <textarea
            id="moderation-content"
            name="content"
            rows={7}
            minLength={resource === "posts" ? 10 : 2}
            maxLength={resource === "posts" ? 10_000 : 3_000}
            defaultValue={item[config.contentKey]}
            required
            className="w-full border border-[var(--border-primary)] bg-[var(--background-elevated)] p-3"
          />
        </FormField>
        {resource === "posts" ? (
          <FormField
            label="Incidente relacionado"
            htmlFor="moderation-related-incident"
            hint="ObjectId de un único incidente; déjalo vacío para quitar la relación."
          >
            <Input
              id="moderation-related-incident"
              name="relatedIncidentId"
              defaultValue={
                item.relatedIncidentId?.id ||
                item.relatedIncidentId?._id ||
                item.relatedIncidentId ||
                ""
              }
            />
          </FormField>
        ) : null}
        <FormField label="Motivo de moderación" htmlFor="moderation-reason" required>
          <textarea
            id="moderation-reason"
            rows={3}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full border border-[var(--border-primary)] bg-[var(--background-elevated)] p-3"
          />
        </FormField>
        <SubmitStatus
          error={mutation.error}
          success={mutation.isSuccess ? "Contenido actualizado y auditado." : null}
        />
        <Button
          type="submit"
          disabled={mutation.isPending || reason.trim().length < 10}
        >
          {mutation.isPending ? "GUARDANDO" : "GUARDAR EDICIÓN"}
        </Button>
      </form>
    </SystemPanel>
  );
}

export function ModerationPage({ resource }) {
  const config = resourceConfig[resource];
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [postId, setPostId] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const params = useMemo(
    () => ({
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      search: debouncedSearch.trim().length >= 2 ? debouncedSearch.trim() : "",
      status,
      authorId,
      ...(resource === "comments" ? { postId } : {}),
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    [authorId, debouncedSearch, page, postId, resource, status],
  );
  const listQuery = useQuery({
    queryKey: adminQueryKeys[resource](params),
    queryFn: ({ signal }) => adminService[resource].list(params, signal),
  });
  const detailQuery = useQuery({
    queryKey:
      resource === "posts"
        ? adminQueryKeys.post(selectedId)
        : adminQueryKeys.comment(selectedId),
    queryFn: ({ signal }) => adminService[resource].detail(selectedId, signal),
    enabled: Boolean(selectedId),
  });

  async function moderate(values) {
    const id = resourceId(activeAction.row);
    if (activeAction.kind === "hide") {
      await adminService[resource].hide(id, values);
    }
    if (activeAction.kind === "restore") {
      await adminService[resource].restore(id, values);
    }
    if (activeAction.kind === "delete") {
      await adminService[resource].remove(id, values);
    }
    await queryClient.invalidateQueries({ queryKey: ["admin", resource] });
    if (selectedId === id) {
      await queryClient.invalidateQueries({
        queryKey:
          resource === "posts" ? adminQueryKeys.post(id) : adminQueryKeys.comment(id),
      });
    }
  }

  const columns = [
    {
      key: "content",
      header: resource === "posts" ? "Publicación" : "Comentario",
      render: (row) => (
        <div className="max-w-md">
          {row.title ? <strong className="mb-1 block">{row.title}</strong> : null}
          <span className="line-clamp-3 whitespace-normal">{row.content}</span>
          <span className="mt-1 block break-all font-mono text-[0.62rem]">
            {resourceId(row)}
          </span>
        </div>
      ),
    },
    {
      key: "author",
      header: "Autor",
      render: (row) =>
        row.author?.username || row.authorUsername || row.userId || "Anonimizado",
    },
    ...(resource === "comments"
      ? [
          {
            key: "post",
            header: "Publicación",
            render: (row) => row.post?.title || row.postId || "—",
          },
        ]
      : []),
    {
      key: "createdAt",
      header: "Creado",
      render: (row) => formatAdminDate(row.createdAt),
    },
    {
      key: "status",
      header: "Estado",
      render: (row) => <AdminStatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "Acciones",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={buttonClassName({ variant: "secondary" })}
            onClick={() => setSelectedId(resourceId(row))}
          >
            CONTEXTO
          </button>
          {row.status === "hidden" ? (
            <button
              type="button"
              className={buttonClassName({ variant: "primary" })}
              onClick={() => setActiveAction({ kind: "restore", row })}
            >
              RESTAURAR
            </button>
          ) : (
            <button
              type="button"
              className={buttonClassName({ variant: "secondary" })}
              onClick={() => setActiveAction({ kind: "hide", row })}
            >
              OCULTAR
            </button>
          )}
          <button
            type="button"
            className={buttonClassName({ variant: "danger" })}
            onClick={() => setActiveAction({ kind: "delete", row })}
          >
            ELIMINAR
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.permissionDescription}
      />
      <AdminFilters>
        <label className="grid gap-1 text-sm">
          <span className="technical-label">BUSCAR</span>
          <Input
            type="search"
            value={search}
            placeholder={config.searchPlaceholder}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="technical-label">USUARIO</span>
          <Input
            value={authorId}
            placeholder="ObjectId del autor"
            onChange={(event) => {
              setAuthorId(event.target.value);
              setPage(1);
            }}
          />
        </label>
        {resource === "comments" ? (
          <label className="grid gap-1 text-sm">
            <span className="technical-label">PUBLICACIÓN</span>
            <Input
              value={postId}
              placeholder="ID de publicación"
              onChange={(event) => {
                setPostId(event.target.value);
                setPage(1);
              }}
            />
          </label>
        ) : null}
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
            <option value="active">Visible</option>
            <option value="hidden">Oculto</option>
            <option value="deleted">Eliminado</option>
            <option value="pending">Pendiente</option>
          </Select>
        </label>
      </AdminFilters>
      <AdminDataTable
        caption={config.title}
        columns={columns}
        rows={listQuery.data?.items}
        rowKey={resourceId}
        loading={listQuery.isLoading}
        error={listQuery.error}
        onRetry={() => listQuery.refetch()}
        pagination={listQuery.data?.pagination}
        onPageChange={setPage}
      />

      {selectedId ? (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="technical-label mb-0">CONTEXTO E HISTORIAL</h2>
            <Button variant="ghost" onClick={() => setSelectedId(null)}>
              CERRAR
            </Button>
          </div>
          {detailQuery.isLoading ? (
            <p className="technical-label pulse-dot">CARGANDO CONTEXTO</p>
          ) : detailQuery.isError ? (
            <SubmitStatus error={detailQuery.error} />
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              <ModerationEditor
                key={detailQuery.data.updatedAt || selectedId}
                resource={resource}
                item={detailQuery.data}
                onSaved={async () => {
                  await queryClient.invalidateQueries({
                    queryKey: ["admin", resource],
                  });
                  await detailQuery.refetch();
                }}
              />
              <SystemPanel className="p-5">
                <h2 className="text-xl">Historial de moderación</h2>
                <AdminDataTable
                  caption="Historial de moderación"
                  rows={
                    detailQuery.data.moderationHistory || detailQuery.data.history || []
                  }
                  rowKey={(row) => resourceId(row) || `${row.action}-${row.createdAt}`}
                  columns={[
                    { key: "action", header: "Acción" },
                    {
                      key: "actor",
                      header: "Actor",
                      render: (row) =>
                        row.actor?.username || row.actorRole || "Sistema",
                    },
                    { key: "reason", header: "Motivo" },
                    {
                      key: "createdAt",
                      header: "Fecha",
                      render: (row) => formatAdminDate(row.createdAt),
                    },
                  ]}
                />
              </SystemPanel>
            </div>
          )}
        </section>
      ) : null}

      <ConfirmationDialog
        open={Boolean(activeAction)}
        title={`${activeAction?.kind === "restore" ? "Restaurar" : activeAction?.kind === "hide" ? "Ocultar" : "Eliminar"} ${config.singular}`}
        action={`${activeAction?.kind === "restore" ? "Restaurar" : activeAction?.kind === "hide" ? "Ocultar" : "Eliminar lógicamente"} el contenido`}
        resource={activeAction ? resourceId(activeAction.row) : ""}
        consequence={
          activeAction?.kind === "delete"
            ? "El contenido quedará eliminado lógicamente y se conservará su auditoría."
            : "La visibilidad cambiará sin modificar silenciosamente el contenido."
        }
        confirmLabel={
          activeAction?.kind === "restore"
            ? "RESTAURAR"
            : activeAction?.kind === "hide"
              ? "OCULTAR"
              : "ELIMINAR"
        }
        confirmVariant={activeAction?.kind === "restore" ? "primary" : "danger"}
        onClose={() => setActiveAction(null)}
        onConfirm={moderate}
      />
    </>
  );
}
