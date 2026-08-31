import Link from "next/link";

import { classNames } from "@/lib/utils/class-names";

const variants = {
  primary:
    "bg-[var(--selection-primary)] text-[var(--selection-foreground)] border-[var(--selection-primary)] hover:bg-[var(--primary-hover)]",
  secondary:
    "bg-[var(--background-elevated)] text-[var(--foreground-primary)] border-[var(--border-primary)] hover:bg-[var(--background-secondary)]",
  ghost:
    "bg-transparent text-[var(--foreground-primary)] border-transparent hover:border-[var(--border-primary)]",
  danger:
    "bg-[var(--danger-background)] text-[var(--danger-foreground)] border-[var(--danger-background)] hover:bg-[var(--danger-hover)]",
};

export function buttonClassName({ variant = "primary", className } = {}) {
  return classNames(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[2px] border px-4 py-2",
    "font-mono text-[0.72rem] font-bold uppercase tracking-[0.12em]",
    "transition-colors disabled:cursor-not-allowed disabled:opacity-55",
    variants[variant],
    className,
  );
}

export function Button({ variant = "primary", className, type = "button", ...props }) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, className })}
      {...props}
    />
  );
}

export function ButtonLink({ variant = "primary", className, href, ...props }) {
  return (
    <Link href={href} className={buttonClassName({ variant, className })} {...props} />
  );
}
