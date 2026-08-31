export default function AdminLoading() {
  return (
    <div className="grid min-h-[45vh] place-items-center" role="status">
      <div className="system-panel w-full max-w-md p-6">
        <p className="technical-label pulse-dot mb-3">
          CONSULTANDO DATOS ADMINISTRATIVOS
        </p>
        <div className="h-1 overflow-hidden bg-[var(--background-panel)]">
          <div className="scan-line h-full w-1/2 bg-[var(--foreground-primary)]" />
        </div>
      </div>
    </div>
  );
}
