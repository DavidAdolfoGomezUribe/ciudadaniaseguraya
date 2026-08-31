import { Activity, Database, Radio, ScanLine } from "lucide-react";

import { SystemPanel } from "@/components/ui/SystemPanel";

import { landingContent } from "../content/landing-content";
import { ExploreMapButton } from "./ExploreMapButton";

export function PurposePanel() {
  return (
    <SystemPanel className="flex h-full flex-col p-5 lg:p-6">
      <p className="technical-label mb-4">{landingContent.eyebrow}</p>
      <h1
        id="landing-title"
        tabIndex="-1"
        className="mb-5 text-[clamp(1.8rem,3vw,3.6rem)] font-semibold leading-[0.98] tracking-[-0.035em] lg:text-[clamp(1.9rem,2.65vw,3.2rem)]"
      >
        {landingContent.title[0]}
        <span className="mt-1 block text-[var(--foreground-secondary)]">
          {landingContent.title[1]}
        </span>
      </h1>
      <div className="space-y-4 text-sm leading-6 text-[var(--foreground-secondary)]">
        {landingContent.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      <div className="mt-auto pt-5">
        <div className="grid grid-cols-2 gap-px border border-[var(--border-soft)] bg-[var(--border-soft)]">
          {[
            [ScanLine, "ÍNDICE", "H3"],
            [Database, "DATOS", "AGREGADOS"],
            [Radio, "CANAL", "SSE"],
            [Activity, "ESTADO", "DINÁMICO"],
          ].map(([Icon, label, value]) => (
            <div key={label} className="bg-[var(--background-secondary)] p-3">
              <Icon size={15} aria-hidden="true" />
              <p className="technical-label mb-0 mt-2">{label}</p>
              <p className="mb-0 font-mono text-[0.68rem]">{value}</p>
            </div>
          ))}
        </div>
        <ExploreMapButton />
      </div>
    </SystemPanel>
  );
}
