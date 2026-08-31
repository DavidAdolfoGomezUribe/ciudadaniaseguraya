import { SystemPanel } from "@/components/ui/SystemPanel";

export function AuthPanel({ eyebrow, title, description, children }) {
  return (
    <div className="page-grid grid min-h-[calc(100vh-var(--header-height))] place-items-center py-12">
      <SystemPanel className="w-full max-w-lg p-6 sm:p-9">
        <p className="technical-label mb-3">{eyebrow}</p>
        <h1 className="mb-3 text-3xl font-semibold sm:text-4xl">{title}</h1>
        <p className="mb-7 text-sm leading-6 text-[var(--foreground-secondary)]">
          {description}
        </p>
        {children}
      </SystemPanel>
    </div>
  );
}
