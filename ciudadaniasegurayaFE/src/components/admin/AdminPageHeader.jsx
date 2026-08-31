export function AdminPageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 border-b border-[var(--border-primary)] pb-5 sm:flex-row sm:items-end">
      <div className="max-w-3xl">
        <p className="technical-label mb-2">{eyebrow}</p>
        <h1 className="mb-2 text-3xl font-semibold sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mb-0 text-sm leading-6 text-[var(--foreground-secondary)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
