"use client";

import { cellToLatLng, isValidCell } from "h3-js";
import { Bell, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { useMapUiStore } from "@/features/map/state/map-ui.store";

import { useRealtimeUiStore } from "../state/realtime-ui.store";

export function MapNotificationPanel() {
  const [open, setOpen] = useState(false);
  const notifications = useRealtimeUiStore((state) => state.notifications);
  const clearNotifications = useRealtimeUiStore((state) => state.clearNotifications);
  const setViewport = useMapUiStore((state) => state.setViewport);
  const selectH3 = useMapUiStore((state) => state.selectH3);
  const viewport = useMapUiStore((state) => state.viewport);

  if (!notifications.length) return null;

  return (
    <div className="absolute bottom-32 right-3 z-20 md:bottom-7">
      {!open ? (
        <Button
          variant="secondary"
          className="map-overlay-card"
          onClick={() => setOpen(true)}
          aria-label={`${notifications.length} novedades de datos`}
        >
          <Bell size={16} aria-hidden="true" />
          NOVEDADES · {notifications.length}
        </Button>
      ) : (
        <aside className="map-overlay-card max-h-80 w-[min(22rem,calc(100vw-1.5rem))] overflow-auto p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="technical-label mb-0">NOVEDADES DE DATOS</p>
            <Button
              variant="ghost"
              className="size-11 px-0"
              onClick={() => setOpen(false)}
              aria-label="Cerrar novedades"
            >
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
          <ul className="m-0 grid gap-2 p-0">
            {notifications.slice(0, 8).map((notification) => {
              const event = notification.event;
              const h3Index = event.data?.h3Index;
              return (
                <li
                  key={`${event.id}:${h3Index || "general"}`}
                  className="border-t border-[var(--border-soft)] pt-2 text-xs"
                >
                  <p className="technical-label mb-1">
                    {notification.scope === "visible"
                      ? "EN EL ÁREA VISIBLE"
                      : "FUERA DEL ÁREA VISIBLE"}
                  </p>
                  <p className="mb-2">
                    {event.type === "heatmap.updated"
                      ? "Actualización de datos agregados"
                      : "Nuevo incidente validado"}{" "}
                    · {new Date(event.occurredAt).toLocaleTimeString("es-CO")}
                  </p>
                  {h3Index && isValidCell(h3Index) ? (
                    <button
                      type="button"
                      className="font-mono text-[0.66rem] font-bold underline"
                      onClick={() => {
                        const [latitude, longitude] = cellToLatLng(h3Index);
                        setViewport({
                          ...viewport,
                          latitude,
                          longitude,
                          zoom: Math.max(viewport.zoom, 11),
                        });
                        selectH3(h3Index);
                        setOpen(false);
                      }}
                    >
                      VER UBICACIÓN
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="mt-3 text-xs underline"
            onClick={clearNotifications}
          >
            Limpiar novedades
          </button>
        </aside>
      )}
    </div>
  );
}
