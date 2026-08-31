import { ShieldAlert } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { adminRoutes } from "@/lib/navigation/admin-routes";

export function AdminAccessDenied() {
  return (
    <div className="grid min-h-[55vh] place-items-center">
      <section className="system-panel max-w-lg p-7 text-center">
        <ShieldAlert className="mx-auto mb-4" size={32} aria-hidden="true" />
        <p className="technical-label mb-2">ACCESO LIMITADO</p>
        <h1 className="text-2xl">
          Esta sesión no tiene permiso para consultar el módulo
        </h1>
        <p className="text-sm text-[var(--foreground-secondary)]">
          La autorización definitiva también será verificada por el backend.
        </p>
        <ButtonLink href={adminRoutes.dashboard}>VOLVER AL RESUMEN</ButtonLink>
      </section>
    </div>
  );
}
