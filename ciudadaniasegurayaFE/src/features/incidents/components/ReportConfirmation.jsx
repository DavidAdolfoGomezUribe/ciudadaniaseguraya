import { CheckCircle2 } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { SystemPanel } from "@/components/ui/SystemPanel";

export function ReportConfirmation() {
  return (
    <SystemPanel className="p-7 text-center">
      <CheckCircle2
        size={38}
        className="mx-auto mb-4 text-[var(--accent-success)]"
        aria-hidden="true"
      />
      <p className="technical-label">REPORTE · RECIBIDO</p>
      <h2 className="mt-3 text-2xl">Tu reporte fue recibido</h2>
      <p className="mx-auto max-w-xl text-[var(--foreground-secondary)]">
        Los reportes ciudadanos no se muestran automáticamente como información
        confirmada. El sistema buscará coincidencias y aplicará el proceso de validación
        comunitaria.
      </p>
      <ButtonLink href="/" className="mt-4">
        VOLVER AL MAPA
      </ButtonLink>
    </SystemPanel>
  );
}
