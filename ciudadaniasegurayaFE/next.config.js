function originOf(value) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const apiOrigin = originOf(
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3010",
);
const sseOrigin = originOf(
  process.env.NEXT_PUBLIC_SSE_URL || "http://localhost:3010/api/v1/events/stream",
);
const mapTileOrigin = originOf(
  process.env.NEXT_PUBLIC_MAP_TILE_URL ||
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
);
const appHostname = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").hostname;
  } catch {
    return null;
  }
})();
const connectSources = [
  "'self'",
  apiOrigin,
  sseOrigin,
  mapTileOrigin,
  "https://accounts.google.com",
  "https://maps.googleapis.com",
  "https://maps.gstatic.com",
].filter(Boolean);
const developmentEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${developmentEval} https://accounts.google.com https://maps.googleapis.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  `connect-src ${connectSources.join(" ")}`,
  "worker-src 'self' blob:",
  "frame-src https://accounts.google.com",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: appHostname ? [appHostname] : [],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
