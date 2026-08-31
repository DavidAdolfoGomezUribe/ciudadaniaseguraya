import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="page-grid grid min-h-[60vh] place-items-center py-16">
      <div className="system-panel max-w-lg p-8 text-center">
        <p className="technical-label">ERROR · 404</p>
        <h1 className="mt-3 text-3xl">Ruta no localizada</h1>
        <p className="text-[var(--foreground-secondary)]">
          La dirección solicitada no corresponde a un módulo disponible.
        </p>
        <ButtonLink href="/" className="mt-4">
          VOLVER AL MAPA
        </ButtonLink>
      </div>
    </div>
  );
}
