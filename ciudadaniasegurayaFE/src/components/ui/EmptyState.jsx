import { SystemPanel } from "./SystemPanel";

export function EmptyState({ title, children }) {
  return (
    <SystemPanel className="p-6 text-center">
      <p className="technical-label mb-2">{title}</p>
      <div className="mx-auto max-w-xl text-sm text-[var(--foreground-secondary)]">
        {children}
      </div>
    </SystemPanel>
  );
}
