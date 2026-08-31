import { classNames } from "@/lib/utils/class-names";

export function SystemPanel({
  as: Component = "section",
  className,
  children,
  ...props
}) {
  return (
    <Component className={classNames("system-panel", className)} {...props}>
      {children}
    </Component>
  );
}
