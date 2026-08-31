const EVENT_TYPES = [
  "system.connected",
  "incident.created",
  "incident.updated",
  "incident.community_confirmed",
  "incident.admin_verified",
  "incident.rejected",
  "incident.merged",
  "heatmap.updated",
];

const seenIds = new Set();
const seenOrder = [];
const MAX_SEEN_IDS = 500;

function rememberId(id) {
  if (!id || seenIds.has(id)) return false;
  seenIds.add(id);
  seenOrder.push(id);
  if (seenOrder.length > MAX_SEEN_IDS) {
    seenIds.delete(seenOrder.shift());
  }
  return true;
}

export function createSseClient({
  url,
  onEvent,
  onStatus,
  eventSourceFactory = (sourceUrl) => new EventSource(sourceUrl),
}) {
  let source = null;
  let closed = false;
  let retryAttempt = 0;
  let reconnectTimer = null;
  let lastEventId = null;
  const clientId = `web:${crypto.randomUUID()}`;

  function connect() {
    if (closed) return;
    onStatus("connecting");
    const target = new URL(url);
    target.searchParams.set("clientId", clientId);
    if (lastEventId) target.searchParams.set("lastEventId", lastEventId);
    source = eventSourceFactory(target.toString());

    source.onopen = () => {
      retryAttempt = 0;
      onStatus("online");
    };

    for (const type of EVENT_TYPES) {
      source.addEventListener(type, (message) => {
        try {
          const event = JSON.parse(message.data);
          const id = message.lastEventId || event.id;
          if (id && !rememberId(id)) return;
          if (id) lastEventId = id;
          onEvent({ ...event, id: id || event.id, type: event.type || type });
        } catch {
          // A malformed event is ignored without interrupting the channel.
        }
      });
    }

    source.onerror = () => {
      source?.close();
      source = null;
      if (closed) return;
      onStatus(navigator.onLine ? "connecting" : "offline");
      retryAttempt += 1;
      const delay = Math.min(30_000, 1_000 * 2 ** (retryAttempt - 1));
      reconnectTimer = setTimeout(connect, delay + Math.random() * 300);
    };
  }

  connect();
  return {
    close() {
      closed = true;
      clearTimeout(reconnectTimer);
      source?.close();
      source = null;
    },
  };
}
