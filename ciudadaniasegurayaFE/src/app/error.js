"use client";

import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

export default function GlobalError({ reset }) {
  return (
    <div className="page-grid grid min-h-[60vh] place-items-center py-16">
      <div className="system-panel max-w-xl p-8">
        <p className="technical-label mb-2">FALLO DE INTERFAZ</p>
        <h1 className="text-3xl">No pudimos mostrar esta sección</h1>
        <ErrorMessage>
          La información no se perdió. Puedes intentar cargar nuevamente.
        </ErrorMessage>
        <Button className="mt-5" onClick={reset}>
          REINTENTAR
        </Button>
      </div>
    </div>
  );
}
