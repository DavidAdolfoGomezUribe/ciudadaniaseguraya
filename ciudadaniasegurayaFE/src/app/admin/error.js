"use client";

import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

export default function AdminError({ error, reset }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="system-panel max-w-xl p-7">
        <p className="technical-label mb-2">FALLO · MÓDULO ADMINISTRATIVO</p>
        <h1 className="text-2xl">No fue posible mostrar esta sección</h1>
        <ErrorMessage requestId={error?.requestId}>
          La sesión permanece protegida. Intenta consultar nuevamente.
        </ErrorMessage>
        <Button className="mt-5" onClick={reset}>
          REINTENTAR
        </Button>
      </div>
    </div>
  );
}
