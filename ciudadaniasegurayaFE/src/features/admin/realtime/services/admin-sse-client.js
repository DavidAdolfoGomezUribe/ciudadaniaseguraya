import { getAdminAccessToken } from "@/features/admin/auth/state/admin-access-token-vault";
import { refreshAdminSession } from "@/lib/api/admin-api-client";
import { endpoints } from "@/lib/api/endpoints";
import { publicEnv } from "@/lib/validation/env.schema";

function parseSseBlock(block) {
  let type = "message";
  let id = null;
  const data = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    if (line.startsWith("id:")) id = line.slice(3).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  try {
    const parsed = JSON.parse(data.join("\n"));
    return { ...parsed, id: id || parsed.id, type: parsed.type || type };
  } catch {
    return null;
  }
}

export function createAdminSseClient({ onEvent, onStatus }) {
  const controller = new AbortController();
  let closed = false;
  let retryAttempt = 0;
  let reconnectTimer = null;
  let lastEventId = null;

  async function connect() {
    if (closed) return;
    onStatus(navigator.onLine ? "connecting" : "offline");
    try {
      let token = getAdminAccessToken();
      if (!token) {
        const refreshed = await refreshAdminSession();
        token = refreshed.accessToken;
      }
      const target = new URL(endpoints.admin.events, publicEnv.apiBaseUrl);
      if (lastEventId) target.searchParams.set("lastEventId", lastEventId);
      const response = await fetch(target, {
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
          ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
        },
        signal: controller.signal,
      });
      if (response.status === 401) {
        await refreshAdminSession();
        throw new Error("ADMIN_SSE_RECONNECT");
      }
      if (!response.ok || !response.body) {
        throw new Error(`ADMIN_SSE_HTTP_${response.status}`);
      }

      retryAttempt = 0;
      onStatus("online");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || "";
        for (const block of blocks) {
          const event = parseSseBlock(block);
          if (!event) continue;
          if (event.id) lastEventId = event.id;
          onEvent(event);
        }
      }
    } catch (error) {
      if (closed || error?.name === "AbortError") return;
      retryAttempt += 1;
      onStatus(navigator.onLine ? "connecting" : "offline");
      const delay = Math.min(30_000, 1000 * 2 ** (retryAttempt - 1));
      reconnectTimer = setTimeout(connect, delay + Math.random() * 250);
    }
  }

  void connect();
  return {
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      controller.abort();
    },
  };
}
