import "./globals.css";

import { cookies } from "next/headers";

import { ApplicationShell } from "@/components/layout/ApplicationShell";
import {
  normalizeTheme,
  THEME_BROWSER_COLORS,
  THEME_STORAGE_KEY,
} from "@/features/theme/theme";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Ciudadanía Segura Ya",
    template: "%s · Ciudadanía Segura Ya",
  },
  description: "Mapa ciudadano de incidentes de seguridad en Colombia.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "Ciudadanía Segura Ya",
    title: "Ciudadanía Segura Ya",
    description: "Mapa ciudadano de incidentes de seguridad en Colombia.",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
};

async function requestTheme() {
  const cookieStore = await cookies();
  return normalizeTheme(cookieStore.get(THEME_STORAGE_KEY)?.value);
}

export async function generateViewport() {
  const theme = await requestTheme();
  return {
    themeColor: THEME_BROWSER_COLORS[theme],
    colorScheme: "light dark",
    width: "device-width",
    initialScale: 1,
  };
}

export default async function RootLayout({ children }) {
  const theme = await requestTheme();

  return (
    <html
      lang="es-CO"
      data-scroll-behavior="smooth"
      data-theme={theme}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <body>
        <a href="#contenido-principal" className="skip-link">
          Saltar al contenido
        </a>
        <ApplicationShell>{children}</ApplicationShell>
      </body>
    </html>
  );
}
