import { SystemPanel } from "@/components/ui/SystemPanel";
import { IncidentReportForm } from "@/features/incidents/components/IncidentReportForm";

export default function ReportIncidentPage() {
  return (
    <div className="page-grid py-12">
      <div className="mb-8 max-w-3xl">
        <p className="technical-label">APORTE · INCIDENTE</p>
        <h1 className="mt-3 text-4xl">Reportar un incidente</h1>
        <p className="text-[var(--foreground-secondary)]">
          Describe el hecho con claridad y evita incluir nombres, documentos u otros
          datos personales. Los reportes se someten a validación antes de incorporarse a
          las estadísticas públicas.
        </p>
      </div>
      <SystemPanel className="mx-auto max-w-4xl p-5 sm:p-8">
        <IncidentReportForm />
      </SystemPanel>
    </div>
  );
}
