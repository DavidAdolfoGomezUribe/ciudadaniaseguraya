import { classNames } from "@/lib/utils/class-names";

const toneClasses = {
  neutral: "border-[var(--border-primary)] text-[var(--foreground-secondary)]",
  info: "border-[var(--accent-information)] text-[var(--accent-information)]",
  success: "border-[var(--accent-success)] text-[var(--accent-success)]",
  warning: "border-[var(--accent-warning)] text-[var(--accent-warning)]",
};

export function StatusBadge({ children, tone = "neutral", className }) {
  return (
    <span
      className={classNames(
        "inline-flex min-h-6 items-center gap-1 border px-2 font-mono text-[0.62rem]",
        "font-bold uppercase tracking-[0.11em]",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
