"use client";

import dynamic from "next/dynamic";

import { QueryRestoreGate } from "@/components/feedback/QueryRestoreGate";

function MapLoading() {
  return (
    <div className="map-shell grid place-items-center" role="status">
      <div className="w-full max-w-xs">
        <p className="technical-label pulse-dot text-center">CARGANDO MOTOR WEBGL</p>
        <div className="mt-3 h-1 overflow-hidden bg-[var(--background-panel)]">
          <div className="scan-line h-full w-1/2 bg-[var(--foreground-primary)]" />
        </div>
      </div>
    </div>
  );
}

const SecurityMap = dynamic(() => import("./SecurityMap"), {
  ssr: false,
  loading: MapLoading,
});

export function MapClientBoundary({ onReady }) {
  return (
    <QueryRestoreGate fallback={<MapLoading />}>
      <SecurityMap onReady={onReady} />
    </QueryRestoreGate>
  );
}
