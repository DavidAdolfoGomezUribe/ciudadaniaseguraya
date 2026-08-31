import { classNames } from "@/lib/utils/class-names";

const statusPresentation = {
  active: ["ACTIVO", "border-[var(--accent-success)] text-[var(--accent-success)]"],
  suspended: [
    "SUSPENDIDO",
    "border-[var(--accent-warning)] text-[var(--accent-warning)]",
  ],
  deleted: [
    "ELIMINADO",
    "border-[var(--border-primary)] text-[var(--foreground-muted)]",
  ],
  pending: [
    "PENDIENTE",
    "border-[var(--accent-information)] text-[var(--accent-information)]",
  ],
  approved: ["APROBADO", "border-[var(--accent-success)] text-[var(--accent-success)]"],
  rejected: [
    "RECHAZADO",
    "border-[var(--accent-warning)] text-[var(--accent-warning)]",
  ],
  hidden: ["OCULTO", "border-[var(--accent-warning)] text-[var(--accent-warning)]"],
};

export function AdminStatusBadge({ status, children, className }) {
  const [label, tone] = statusPresentation[status] || [
    String(status || "desconocido").toUpperCase(),
    "border-[var(--border-primary)] text-[var(--foreground-secondary)]",
  ];
  return (
    <span
      className={classNames(
        "inline-flex min-h-6 items-center border px-2 font-mono text-[0.62rem]",
        "font-bold uppercase tracking-[0.1em]",
        tone,
        className,
      )}
    >
      {children || label}
    </span>
  );
}
