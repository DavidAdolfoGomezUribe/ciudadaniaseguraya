import { forwardRef } from "react";

import { classNames } from "@/lib/utils/class-names";

export const Input = forwardRef(function Input(
  { className, invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={classNames(
        "min-h-11 w-full rounded-[2px] border bg-[var(--background-elevated)] px-3 py-2",
        "text-[var(--foreground-primary)] placeholder:text-[var(--foreground-muted)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        invalid ? "border-[var(--accent-warning)]" : "border-[var(--border-primary)]",
        className,
      )}
      {...props}
    />
  );
});
