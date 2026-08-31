const sensitiveKey = /password|hash|token|secret|cookie|authorization/i;

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      sensitiveKey.test(key) ? "[OCULTO]" : redact(nested),
    ]),
  );
}

export function AuditDetails({ log }) {
  if (!log) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="technical-label">VALOR ANTERIOR</p>
        <pre className="max-h-80 overflow-auto border border-[var(--border-soft)] bg-[var(--background-secondary)] p-3 text-xs">
          {JSON.stringify(redact(log.previousValue || null), null, 2)}
        </pre>
      </div>
      <div>
        <p className="technical-label">VALOR NUEVO</p>
        <pre className="max-h-80 overflow-auto border border-[var(--border-soft)] bg-[var(--background-secondary)] p-3 text-xs">
          {JSON.stringify(redact(log.newValue || null), null, 2)}
        </pre>
      </div>
    </div>
  );
}
