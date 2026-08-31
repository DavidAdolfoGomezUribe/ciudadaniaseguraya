const wildcardPlaceholder = "csyoriginwildcard";
const wildcardTokenPattern = /\*/g;
const safeWildcardPattern = "[a-z0-9-]+";

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countWildcards(value) {
  return value.match(wildcardTokenPattern)?.length ?? 0;
}

function parsedHttpUrl(value, label) {
  let url;

  try {
    url = new URL(value);
  } catch (_error) {
    throw new Error(`${label} no es una URL valida: ${value}`);
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${label} debe ser un origen HTTP(S) sin ruta: ${value}`);
  }

  return url;
}

export function normalizeHttpOrigin(value, label = "Origen") {
  return parsedHttpUrl(value.trim(), label).origin;
}

export function compileOriginPattern(value) {
  const pattern = value.trim().toLowerCase();
  const wildcardCount = countWildcards(pattern);

  if (wildcardCount === 0) {
    throw new Error(
      `El patron CORS debe contener al menos un comodin: ${pattern}`,
    );
  }

  const placeholderValue = pattern.replaceAll("*", wildcardPlaceholder);
  const url = parsedHttpUrl(placeholderValue, "Patron CORS");
  const placeholderCount = url.hostname
    .split(wildcardPlaceholder)
    .length - 1;

  if (
    url.protocol !== "https:" ||
    placeholderCount !== wildcardCount ||
    !url.hostname.includes(wildcardPlaceholder)
  ) {
    throw new Error(
      `El patron CORS solo admite comodines en el hostname HTTPS: ${pattern}`,
    );
  }

  const firstLabel = url.hostname.split(".")[0];
  const pinnedLabel = firstLabel
    .replaceAll(wildcardPlaceholder, "")
    .replaceAll("-", "");

  if (pinnedLabel.length < 3) {
    throw new Error(
      `El patron CORS debe fijar el proyecto o equipo: ${pattern}`,
    );
  }

  const escapedOrigin = escapeRegularExpression(url.origin).replaceAll(
    wildcardPlaceholder,
    safeWildcardPattern,
  );

  return new RegExp(`^${escapedOrigin}$`, "i");
}

export function isAllowedOrigin(
  origin,
  allowedOrigins,
  allowedOriginPatterns = [],
) {
  if (origin === undefined) {
    return true;
  }

  let normalizedOrigin;

  try {
    normalizedOrigin = new URL(origin).origin;
  } catch (_error) {
    return false;
  }

  return (
    allowedOrigins.includes(normalizedOrigin) ||
    allowedOriginPatterns.some((pattern) => pattern.test(normalizedOrigin))
  );
}
