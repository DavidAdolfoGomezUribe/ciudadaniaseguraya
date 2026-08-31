import { z } from "zod";

const tileUrlTemplate = z.string().refine(
  (value) => {
    if (!["{z}", "{x}", "{y}"].every((token) => value.includes(token))) {
      return false;
    }

    try {
      const parsed = new URL(
        value.replace("{z}", "0").replace("{x}", "0").replace("{y}", "0"),
      );
      return parsed.protocol === "https:" || parsed.hostname === "localhost";
    } catch {
      return false;
    }
  },
  { message: "La URL de teselas debe ser HTTPS e incluir {z}, {x} y {y}" },
);
const objectIdOrEmpty = z.union([
  z.literal(""),
  z.string().regex(/^[a-f\d]{24}$/i, "El ID de ciudad no es válido"),
]);

const publicEnvSchema = z
  .object({
    appName: z.string().min(1),
    appUrl: z.url(),
    apiBaseUrl: z.url(),
    adminLoginPath: z
      .string()
      .startsWith("/")
      .refine((value) => !value.startsWith("//")),
    adminDashboardPath: z
      .string()
      .startsWith("/")
      .refine((value) => !value.startsWith("//")),
    sseUrl: z.url(),
    mapTileUrl: tileUrlTemplate,
    defaultCityId: objectIdOrEmpty,
    defaultCitySlug: z.string().min(1),
    googleMapsApiKey: z.string(),
    mapMinZoom: z.coerce.number().min(0).max(20),
    mapMaxZoom: z.coerce.number().min(1).max(24),
    maxVisibleH3Cells: z.coerce.number().int().min(100).max(50_000),
    cacheVersion: z.string().min(1),
    cacheBuildId: z.string().min(1),
    cacheMaxAgeMs: z.coerce.number().int().min(60_000),
  })
  .refine((value) => value.mapMaxZoom > value.mapMinZoom, {
    message: "El zoom máximo debe ser mayor al mínimo",
    path: ["mapMaxZoom"],
  });

const rawPublicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Ciudadania Segura Ya",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3010",
  adminLoginPath: process.env.NEXT_PUBLIC_ADMIN_LOGIN_PATH || "/login/admin",
  adminDashboardPath: process.env.NEXT_PUBLIC_ADMIN_DASHBOARD_PATH || "/admin",
  sseUrl:
    process.env.NEXT_PUBLIC_SSE_URL || "http://localhost:3010/api/v1/events/stream",
  mapTileUrl:
    process.env.NEXT_PUBLIC_MAP_TILE_URL ||
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  defaultCityId: process.env.NEXT_PUBLIC_DEFAULT_CITY_ID || "",
  defaultCitySlug: process.env.NEXT_PUBLIC_DEFAULT_CITY_SLUG || "bogota",
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  mapMinZoom: process.env.NEXT_PUBLIC_MAP_MIN_ZOOM || "4.5",
  mapMaxZoom: process.env.NEXT_PUBLIC_MAP_MAX_ZOOM || "17",
  maxVisibleH3Cells: process.env.NEXT_PUBLIC_H3_MAX_VISIBLE_CELLS || "12000",
  cacheVersion: process.env.NEXT_PUBLIC_CACHE_VERSION || "1",
  cacheBuildId: process.env.NEXT_PUBLIC_CACHE_BUILD_ID || "local",
  cacheMaxAgeMs:
    process.env.NEXT_PUBLIC_CACHE_MAX_AGE_MS || String(24 * 60 * 60 * 1000),
};

const parsed = publicEnvSchema.safeParse(rawPublicEnv);

if (!parsed.success) {
  const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Variables públicas inválidas: ${fields}`);
}

export const publicEnv = Object.freeze(parsed.data);
