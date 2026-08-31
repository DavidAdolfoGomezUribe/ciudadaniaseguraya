import { AppError } from "../../../../shared/errors/app-error.js";

function agentUnavailable(
  message = "El servicio del agente no esta disponible",
  cause,
) {
  return new AppError({
    code: "AGENT_UNAVAILABLE",
    message,
    statusCode: 503,
    cause,
  });
}

function safeAgentMessage(payload) {
  const message = payload?.detail?.message || payload?.message;
  return typeof message === "string" && message.trim()
    ? message.trim().slice(0, 300)
    : null;
}

export function createAgentControlService({
  config,
  auditRepository,
  fetchImpl = globalThis.fetch,
  clock = () => new Date(),
}) {
  async function callAgent(path, { method = "GET", body } = {}) {
    if (!config.agentServiceUrl || !config.agentControlApiKey) {
      throw agentUnavailable("El control del agente no esta configurado");
    }

    let response;
    try {
      response = await fetchImpl(new URL(path, `${config.agentServiceUrl}/`), {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(config.agentRequestTimeoutMs),
        headers: {
          "X-Agent-Control-Key": config.agentControlApiKey,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      throw agentUnavailable(undefined, error);
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (_error) {
      throw agentUnavailable("El agente devolvio una respuesta inesperada");
    }
    if (!response.ok) {
      const message = safeAgentMessage(payload) || "El agente rechazo la solicitud";
      throw new AppError({
        code:
          response.status === 400
            ? "INVALID_AGENT_RUN"
            : response.status === 409
              ? "AGENT_RUN_CONFLICT"
              : "AGENT_UNAVAILABLE",
        message,
        statusCode:
          response.status === 400
            ? 400
            : response.status === 404
              ? 404
              : response.status === 409
                ? 409
                : 503,
      });
    }
    return payload;
  }

  async function record(actor, action, run, requestId, input = null) {
    await auditRepository.record({
      actorId: actor.id,
      actorRole: actor.role,
      action,
      resourceType: "agentRun",
      resourceId: run?.id ?? null,
      previousValue: null,
      newValue: input,
      metadata: {
        provider: run?.provider ?? input?.provider ?? null,
        model: run?.model ?? input?.model ?? null,
        limit: run?.limit ?? input?.limit ?? null,
        maxArticles: run?.maxArticles ?? input?.maxArticles ?? null,
        ingest: run?.ingest ?? input?.ingest ?? false,
      },
      requestId,
      createdAt: clock(),
    });
  }

  return Object.freeze({
    status() {
      return callAgent("control/status");
    },
    async start(body, actor, requestId) {
      const run = await callAgent("control/runs", { method: "POST", body });
      await record(actor, "agent.run.start", run, requestId, body);
      return run;
    },
    async cancel(runId, actor, requestId) {
      const run = await callAgent(`control/runs/${runId}/cancel`, {
        method: "POST",
      });
      await record(actor, "agent.run.cancel", run, requestId);
      return run;
    },
  });
}
