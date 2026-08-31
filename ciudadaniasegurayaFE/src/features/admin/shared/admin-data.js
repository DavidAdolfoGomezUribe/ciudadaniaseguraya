export const DEFAULT_PAGE_SIZE = 25;

export function adminQueryString(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  return query.toString();
}

export function normalizeAdminPage(result) {
  const payload = result?.data;
  const items = Array.isArray(payload)
    ? payload
    : payload?.items || payload?.results || payload?.records || [];
  const pagination =
    (!Array.isArray(payload) && payload?.pagination) ||
    result?.meta?.pagination ||
    result?.meta ||
    {};
  const page = Number(pagination.page || 1);
  const pageSize = Number(pagination.pageSize || DEFAULT_PAGE_SIZE);
  const total = Number(pagination.total ?? items.length);
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Number(
        pagination.totalPages || Math.max(1, Math.ceil(total / pageSize)),
      ),
    },
    meta: result?.meta || {},
  };
}

export function resourceId(resource) {
  return resource?.id || resource?._id || "";
}

export function formatAdminDate(value, { withTime = true } = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

export function elapsedLabel(value) {
  if (!value) return "—";
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed)) return "—";
  const hours = Math.max(0, Math.floor(elapsed / 3_600_000));
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

export function primaryCollectionValue(resource, keys) {
  for (const key of keys) {
    if (resource?.[key] !== undefined && resource?.[key] !== null) {
      return resource[key];
    }
  }
  return "—";
}
