import { forwardRef } from "react";

import { classNames } from "@/lib/utils/class-names";

export const Select = forwardRef(function Select(
  { className, invalid = false, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={classNames(
        "min-h-11 w-full rounded-[2px] border bg-[var(--background-elevated)] px-3 py-2",
        invalid ? "border-[var(--accent-warning)]" : "border-[var(--border-primary)]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
