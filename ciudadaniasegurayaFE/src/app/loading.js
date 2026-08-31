export default function Loading() {
  return (
    <div className="page-grid grid min-h-[55vh] place-items-center" role="status">
      <div className="w-full max-w-md border border-[var(--border-primary)] bg-[var(--background-elevated)] p-6">
        <p className="technical-label pulse-dot mb-3">CARGANDO MÓDULO DE INTERFAZ</p>
        <div className="h-1 overflow-hidden bg-[var(--background-panel)]">
          <div className="scan-line h-full w-1/2 bg-[var(--foreground-primary)]" />
        </div>
      </div>
    </div>
  );
}
