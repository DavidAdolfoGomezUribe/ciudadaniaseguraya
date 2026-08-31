"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CircleStop, Play, RefreshCw } from "lucide-react";
import { useState } from "react";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { FormField } from "@/components/forms/FormField";
import { SubmitStatus } from "@/components/forms/SubmitStatus";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SystemPanel } from "@/components/ui/SystemPanel";
import { adminQueryKeys } from "@/lib/query/admin-query-keys";
import { classNames } from "@/lib/utils/class-names";

import { adminService } from "../../services/admin.service";

const activeStatuses = new Set(["collecting", "analyzing", "ingesting", "cancelling"]);

function StatusLed({ active, busy }) {
  const label = active
    ? busy
      ? "Agente ejecutando"
      : "Servicio disponible"
    : "Sin conexión";
  return (
    <div className="flex items-center gap-3" role="status" aria-label={label}>
      <span
        className={classNames(
          "size-3 rounded-full border",
          active
            ? busy
              ? "animate-pulse border-amber-700 bg-amber-400"
              : "border-emerald-800 bg-emerald-500"
            : "border-red-900 bg-red-500",
        )}
        aria-hidden="true"
      />
      <span className="technical-label">{label.toUpperCase()}</span>
    </div>
  );
}

function ProviderSwitch({ value, onChange, disabled }) {
  return (
    <div
      className="grid grid-cols-2 border border-[var(--border-primary)]"
      role="radiogroup"
      aria-label="Proveedor del agente"
    >
      {[
        ["openai", "OPENAI API"],
        ["ollama", "OLLAMA LOCAL"],
      ].map(([provider, label]) => (
        <button
          key={provider}
          type="button"
          role="radio"
          aria-checked={value === provider}
          disabled={disabled}
          onClick={() => onChange(provider)}
          className={classNames(
            "min-h-12 border-r border-[var(--border-primary)] px-3 font-mono text-xs font-bold last:border-r-0",
            value === provider
              ? "bg-[var(--selection-primary)] text-[var(--selection-foreground)]"
              : "bg-[var(--background-elevated)]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function RunSummary({ run }) {
  if (!run) {
    return (
      <p className="mb-0 text-sm text-[var(--foreground-secondary)]">
        Todavía no hay una ejecución en este proceso.
      </p>
    );
  }
  const analysis = run.analysis;
  return (
    <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
      <div>
        <dt className="technical-label">ESTADO</dt>
        <dd className="mt-1 font-mono">{run.status}</dd>
      </div>
      <div>
        <dt className="technical-label">REVISADOS</dt>
        <dd className="mt-1 font-mono">
          {analysis?.totalArticles ?? run.collection?.articlesCollected ?? 0}/
          {run.maxArticles ?? run.limit}
        </dd>
      </div>
      <div>
        <dt className="technical-label">VÁLIDOS</dt>
        <dd className="mt-1 font-mono">
          {analysis?.acceptedIncidents ?? 0}/{run.limit}
        </dd>
      </div>
      <div>
        <dt className="technical-label">RECHAZADOS</dt>
        <dd className="mt-1 font-mono">{analysis?.rejectedArticles ?? 0}</dd>
      </div>
      <div>
        <dt className="technical-label">ERRORES API</dt>
        <dd className="mt-1 font-mono">{analysis?.providerErrors ?? 0}</dd>
      </div>
      <div>
        <dt className="technical-label">ENVIADOS</dt>
        <dd className="mt-1 font-mono">{run.ingestionReceipts?.length ?? 0}</dd>
      </div>
    </dl>
  );
}

export function AgentControlPage() {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [limit, setLimit] = useState("5");
  const [maxArticles, setMaxArticles] = useState("50");
  const [ingest, setIngest] = useState(false);
  const query = useQuery({
    queryKey: adminQueryKeys.agent,
    queryFn: ({ signal }) => adminService.agent.status(signal),
    refetchInterval: 2_000,
    retry: 1,
  });
  const status = query.data;
  const run = status?.run;
  const busy = Boolean(run && activeStatuses.has(run.status));
  const providerState = status?.providers?.[provider];
  const models = providerState?.models || [];

  const selectedModel = models.includes(model)
    ? model
    : providerState?.defaultModel && models.includes(providerState.defaultModel)
      ? providerState.defaultModel
      : models[0] || "";

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: adminQueryKeys.agent });
  };
  const start = useMutation({
    mutationFn: adminService.agent.start,
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: adminService.agent.cancel,
    onSuccess: refresh,
  });
  const logs = run?.logs || [];
  const numericLimit = Number(limit);
  const numericMaxArticles = Number(maxArticles);
  const canStart =
    !busy &&
    providerState?.available === true &&
    Boolean(selectedModel) &&
    Number.isInteger(numericLimit) &&
    numericLimit >= 1 &&
    numericLimit <= 100 &&
    Number.isInteger(numericMaxArticles) &&
    numericMaxArticles >= numericLimit &&
    numericMaxArticles <= 100;

  return (
    <>
      <AdminPageHeader
        eyebrow="SUPERADMIN · OPERACIÓN CON APROBACIÓN HUMANA"
        title="Agente de incidentes"
        description="Selecciona el proveedor, controla una ejecución y observa sus decisiones sin exponer credenciales al navegador."
      />

      <div className="grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <SystemPanel className="grid content-start gap-5 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <StatusLed
              active={!query.isError && status?.serviceActive === true}
              busy={busy}
            />
            <button
              type="button"
              aria-label="Actualizar estado"
              onClick={() => void query.refetch()}
              className="grid size-10 place-items-center border border-[var(--border-primary)]"
            >
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>

          <ProviderSwitch
            value={provider}
            onChange={(value) => {
              setProvider(value);
              setModel("");
            }}
            disabled={busy}
          />

          <FormField
            label="Modelo"
            htmlFor="agent-model"
            hint={
              providerState?.message || "Modelo verificado por el servicio del agente."
            }
          >
            <select
              id="agent-model"
              value={selectedModel}
              onChange={(event) => setModel(event.target.value)}
              disabled={busy || !models.length}
              className="min-h-12 w-full border border-[var(--border-primary)] bg-[var(--background-elevated)] px-3"
            >
              {!models.length ? (
                <option value="">Sin modelos disponibles</option>
              ) : null}
              {models.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Objetivo de noticias válidas"
            htmlFor="agent-limit"
            hint="La ejecución se detiene al alcanzar este número de incidentes validados."
          >
            <Input
              id="agent-limit"
              type="number"
              min="1"
              max="100"
              value={limit}
              disabled={busy}
              onChange={(event) => setLimit(event.target.value)}
            />
          </FormField>

          <FormField
            label="Máximo de noticias a revisar"
            htmlFor="agent-max-articles"
            hint="Límite de costo: debe ser igual o mayor que el objetivo."
          >
            <Input
              id="agent-max-articles"
              type="number"
              min={limit || "1"}
              max="100"
              value={maxArticles}
              disabled={busy}
              onChange={(event) => setMaxArticles(event.target.value)}
            />
          </FormField>

          <label className="flex items-start gap-3 border border-[var(--border-primary)] p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={ingest}
              disabled={busy}
              onChange={(event) => setIngest(event.target.checked)}
            />
            <span>
              <strong>Enviar válidos al backend</strong>
              <span className="mt-1 block text-[var(--foreground-secondary)]">
                Cada candidato aceptado creará un incidente pendiente. No hay reintentos
                automáticos de POST.
              </span>
            </span>
          </label>

          <SubmitStatus
            error={query.error || start.error || cancel.error}
            success={start.isSuccess ? "La ejecución fue autorizada." : null}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              disabled={!canStart || start.isPending}
              onClick={() => {
                const warning = ingest
                  ? `Se buscarán ${numericLimit} incidentes válidos revisando hasta ${numericMaxArticles} noticias y se enviarán al backend. ¿Confirmas?`
                  : `Se buscarán ${numericLimit} incidentes válidos revisando hasta ${numericMaxArticles} noticias, sin escribir en el backend. ¿Confirmas?`;
                if (!window.confirm(warning)) return;
                start.mutate({
                  provider,
                  model: selectedModel,
                  limit: numericLimit,
                  maxArticles: numericMaxArticles,
                  ingest,
                  confirmIngest: ingest,
                });
              }}
            >
              <Play size={16} aria-hidden="true" />{" "}
              {start.isPending ? "INICIANDO" : "EJECUTAR"}
            </Button>
            <Button
              type="button"
              disabled={!busy || cancel.isPending || !run?.id}
              onClick={() => cancel.mutate(run.id)}
            >
              <CircleStop size={16} aria-hidden="true" /> DETENER
            </Button>
          </div>
        </SystemPanel>

        <div className="grid gap-5">
          <SystemPanel className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Bot size={18} aria-hidden="true" />
              <h2 className="mb-0 text-lg">Ejecución actual</h2>
            </div>
            <RunSummary run={run} />
            {run?.error ? (
              <p className="mt-4 mb-0 text-sm text-red-700">{run.error}</p>
            ) : null}
            {run?.ingestionFailures ? (
              <p className="mt-4 mb-0 text-sm text-amber-700">
                {run.ingestionFailures} envío(s) al backend no fueron confirmados.
                Revisa el log antes de reintentar.
              </p>
            ) : null}
            {run?.status === "completed_partial" ? (
              <p className="mt-4 mb-0 text-sm text-amber-700">
                El agente agotó el máximo de noticias sin alcanzar el objetivo de
                válidos. Revisa los motivos de rechazo en el log.
              </p>
            ) : null}
            {run?.analysis?.providerErrors ? (
              <p className="mt-4 mb-0 text-sm text-red-700">
                Se detectaron {run.analysis.providerErrors} error(es) del proveedor;
                no se contabilizan como noticias inválidas.
              </p>
            ) : null}
          </SystemPanel>

          <SystemPanel className="min-h-[28rem] overflow-hidden">
            <div className="border-b border-[var(--border-primary)] px-5 py-4">
              <h2 className="mb-0 font-mono text-sm">LOG DEL AGENTE</h2>
            </div>
            <div
              className="h-[28rem] overflow-auto bg-neutral-950 p-4 font-mono text-xs leading-6 text-neutral-100"
              role="log"
              aria-live="polite"
            >
              {logs.length ? (
                logs.map((entry, index) => (
                  <div
                    key={`${entry.timestamp}-${index}`}
                    className={
                      entry.level === "error"
                        ? "text-red-300"
                        : entry.level === "warning"
                          ? "text-amber-300"
                          : "text-emerald-200"
                    }
                  >
                    [{entry.timestamp}] {entry.level.toUpperCase()} {entry.message}
                  </div>
                ))
              ) : (
                <span className="text-neutral-400">
                  Esperando una ejecución aprobada…
                </span>
              )}
            </div>
          </SystemPanel>
        </div>
      </div>
    </>
  );
}
