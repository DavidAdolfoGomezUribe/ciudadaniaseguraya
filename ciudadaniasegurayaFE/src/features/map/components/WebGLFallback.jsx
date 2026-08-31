import { AlertTriangle } from "lucide-react";

import { SystemPanel } from "@/components/ui/SystemPanel";

export function WebGLFallback() {
  return (
    <SystemPanel className="grid min-h-[580px] place-items-center p-8 text-center">
      <div className="max-w-lg">
        <AlertTriangle className="mx-auto mb-4" size={32} aria-hidden="true" />
        <p className="technical-label">MODO DE COMPATIBILIDAD</p>
        <h3 className="mt-3 text-2xl">WebGL no está disponible</h3>
        <p className="text-[var(--foreground-secondary)]">
          El mapa interactivo no puede mostrarse en este dispositivo. Las estadísticas y
          filtros de la página siguen disponibles debajo.
        </p>
      </div>
    </SystemPanel>
  );
}
