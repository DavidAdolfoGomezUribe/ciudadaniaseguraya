export function ErrorMessage({ id, children, requestId }) {
  if (!children) return null;

  return (
    <div
      id={id}
      role="alert"
      className="border-l-4 border-[var(--accent-warning)] bg-[var(--surface-warning)] px-3 py-2 text-sm"
    >
      <p className="mb-0">{children}</p>
      {requestId ? (
        <p className="mb-0 mt-1 font-mono text-[0.68rem] text-[var(--foreground-secondary)]">
          REFERENCIA · {requestId}
        </p>
      ) : null}
    </div>
  );
}
