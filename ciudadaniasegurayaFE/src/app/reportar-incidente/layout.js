import { AuthGate } from "@/features/auth/components/AuthGate";

export const metadata = {
  title: "Reportar incidente",
  description: "Envía un reporte ciudadano para validación comunitaria.",
  robots: { index: false, follow: false },
};

export default function ReportIncidentLayout({ children }) {
  return <AuthGate>{children}</AuthGate>;
}
