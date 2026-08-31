import { describe, expect, it, vi } from "vitest";

import { createAgentControlService } from "./agent-control.service.js";

const configured = {
  agentServiceUrl: "http://agent:8000",
  agentControlApiKey: "c".repeat(32),
  agentRequestTimeoutMs: 5_000,
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("agent control service", () => {
  it("proxies status with the server-side credential", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ serviceActive: true, providers: {}, run: null }),
    );
    const service = createAgentControlService({
      config: configured,
      auditRepository: { record: vi.fn() },
      fetchImpl,
    });

    const result = await service.status();

    expect(result.serviceActive).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url.toString()).toBe("http://agent:8000/control/status");
    expect(options.headers["X-Agent-Control-Key"]).toBe("c".repeat(32));
  });

  it("audits an explicitly approved start without storing secrets", async () => {
    const run = {
      id: "a".repeat(32),
      provider: "openai",
      model: "gpt-5.6-luna",
      limit: 5,
      maxArticles: 50,
      ingest: true,
    };
    const auditRepository = { record: vi.fn().mockResolvedValue(undefined) };
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(run, 202));
    const service = createAgentControlService({
      config: configured,
      auditRepository,
      fetchImpl,
      clock: () => new Date("2026-08-30T15:59:00.000Z"),
    });

    await service.start(
      { ...run, confirmIngest: true },
      { id: "66a000000000000000000099", role: "superadmin" },
      "request-1",
    );

    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "agent.run.start",
        resourceId: run.id,
        actorRole: "superadmin",
        requestId: "request-1",
      }),
    );
    expect(JSON.stringify(auditRepository.record.mock.calls)).not.toContain(
      configured.agentControlApiKey,
    );
  });

  it("fails closed when the agent connection is not configured", async () => {
    const service = createAgentControlService({
      config: { ...configured, agentControlApiKey: "" },
      auditRepository: { record: vi.fn() },
      fetchImpl: vi.fn(),
    });

    await expect(service.status()).rejects.toMatchObject({
      code: "AGENT_UNAVAILABLE",
      statusCode: 503,
    });
  });
});
