import { pathToFileURL } from "node:url";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3010";

export const requiredOperations = Object.freeze([
  ["get", "/health"],
  ["get", "/ready"],
  ["post", "/api/v1/auth/register"],
  ["post", "/api/v1/auth/login"],
  ["post", "/api/v1/auth/refresh"],
  ["post", "/api/v1/auth/logout"],
  ["get", "/api/v1/auth/me"],
  ["get", "/api/v1/geolocation/cities"],
  ["get", "/api/v1/geolocation/config"],
  ["get", "/api/v1/geolocation/cell"],
  ["get", "/api/v1/geolocation/heatmap"],
  ["get", "/api/v1/geolocation/hexagons/{h3Index}"],
  ["get", "/api/v1/geolocation/hexagons/{h3Index}/statistics"],
  ["get", "/api/v1/incidents/types"],
  ["post", "/api/v1/incidents/reports"],
  ["get", "/api/v1/incidents"],
  ["get", "/api/v1/incidents/{incidentId}"],
  ["get", "/api/v1/incidents/nearby"],
  ["get", "/api/v1/events/stream"],
  ["get", "/api/v1/statistics/overview"],
  ["get", "/api/v1/statistics/timeseries"],
  ["get", "/api/v1/statistics/hourly"],
  ["get", "/api/v1/statistics/types"],
]);

export function missingOperations(document) {
  return requiredOperations.filter(
    ([method, path]) => !document.paths?.[path]?.[method],
  );
}

async function main() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(new URL("/docs/json", apiBaseUrl), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`OpenAPI respondió HTTP ${response.status}`);
    }
    const document = await response.json();
    const missing = missingOperations(document);
    if (missing.length) {
      process.stderr.write(
        `Contrato incompleto:\n${missing
          .map(([method, path]) => `- ${method.toUpperCase()} ${path}`)
          .join("\n")}\n`,
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      `Contrato compatible: ${requiredOperations.length} operaciones verificadas.\n`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`No fue posible comprobar el backend: ${error.message}\n`);
    process.exitCode = 1;
  });
}
