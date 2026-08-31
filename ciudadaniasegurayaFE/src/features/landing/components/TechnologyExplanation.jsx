import { Binary, ChartNoAxesCombined, ShieldCheck } from "lucide-react";

import { landingContent } from "../content/landing-content";

export function TechnologyExplanation() {
  return (
    <section className="border-y border-[var(--border-primary)] bg-[var(--background-secondary)]">
      <div className="page-grid grid gap-8 py-10 md:grid-cols-[1.4fr_1fr] md:items-center">
        <div>
          <p className="technical-label mb-2">CÓMO FUNCIONA · 03 CAPAS</p>
          <h2 className="mb-3 text-2xl font-semibold">
            De reportes aislados a contexto colectivo
          </h2>
          <p className="mb-0 max-w-3xl leading-7 text-[var(--foreground-secondary)]">
            {landingContent.technology}
          </p>
        </div>
        <ol className="m-0 grid gap-2 p-0">
          {[
            [Binary, "01", "Indexación geográfica H3"],
            [ShieldCheck, "02", "Validación comunitaria o administrativa"],
            [ChartNoAxesCombined, "03", "Agregación temporal y visual"],
          ].map(([Icon, number, text]) => (
            <li
              key={number}
              className="flex min-h-14 items-center gap-3 border border-[var(--border-soft)] bg-[var(--background-elevated)] px-4"
            >
              <Icon size={18} aria-hidden="true" />
              <span className="font-mono text-xs">{number}</span>
              <span className="text-sm">{text}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
