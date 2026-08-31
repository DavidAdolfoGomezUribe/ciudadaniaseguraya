import { Crosshair, MousePointer2 } from "lucide-react";

import { Button } from "@/components/ui/Button";

export function MapControls({ activated, onDeactivate, onReset }) {
  if (!activated) return null;

  return (
    <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-2">
      <Button
        variant="secondary"
        className="map-overlay-card"
        onClick={onReset}
        aria-label="Volver a encuadrar Bogotá"
      >
        <Crosshair size={15} aria-hidden="true" /> BOGOTÁ
      </Button>
      <Button variant="secondary" className="map-overlay-card" onClick={onDeactivate}>
        <MousePointer2 size={15} aria-hidden="true" /> LIBERAR RUEDA
      </Button>
    </div>
  );
}
