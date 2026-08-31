"use client";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useMapUiStore } from "@/features/map/state/map-ui.store";

export function ExploreMapButton() {
  const activate = useMapUiStore((state) => state.activate);

  return (
    <Button
      className="mt-5 w-full justify-between"
      onClick={() => {
        activate();
        document.getElementById("mapa-seguridad")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }}
    >
      EXPLORAR MAPA
      <ArrowRight size={16} aria-hidden="true" />
    </Button>
  );
}
