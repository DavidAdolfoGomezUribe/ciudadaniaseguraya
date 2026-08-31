export function FormField({ label, htmlFor, hint, error, required = false, children }) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;

  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={hintId} className="mb-0 text-xs text-[var(--foreground-secondary)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mb-0 text-sm text-[var(--accent-warning)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
