"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useMapUiStore } from "@/features/map/state/map-ui.store";
import { eventIsVisible } from "@/features/map/utils/event-visibility";
import { publicEnv } from "@/lib/validation/env.schema";

import { createSseClient } from "../services/sse-client";
import { useRealtimeUiStore } from "../state/realtime-ui.store";

function invalidateRollingData(queryClient, scope) {
  void queryClient.invalidateQueries({
    queryKey: ["heatmap", scope.cityId, scope.period],
  });
  void queryClient.invalidateQueries({
    queryKey: ["hexagon", scope.cityId, scope.period],
  });
  void queryClient.invalidateQueries({ queryKey: ["statistics"] });
}

export function RealtimeProvider({ children }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = createSseClient({
      url: publicEnv.sseUrl,
      onStatus: useRealtimeUiStore.getState().setStatus,
      onEvent(event) {
        useRealtimeUiStore.getState().setLastEventId(event.id);
        const map = useMapUiStore.getState();
        const scope = {
          cityId: map.activeCityId,
          period: map.period,
          resolution: map.resolution,
          incidentType: map.incidentType,
          visibleH3Indexes: map.visibleH3Indexes,
          bounds: map.committedBounds,
        };

        if (event.type === "heatmap.updated") {
          const updates = event.data?.updates || [];
          const resolutions = event.data?.resolutions || [];
          const appliesToResolution =
            resolutions.length === 0 ||
            resolutions.includes(scope.resolution) ||
            updates.some((update) => update.resolution === scope.resolution);

          if (event.data?.cityId === scope.cityId && appliesToResolution) {
            invalidateRollingData(queryClient, scope);
          }

          if (!updates.length) {
            return;
          }

          for (const update of updates) {
            if (update.resolution !== scope.resolution) continue;

            const matchesType =
              !scope.incidentType || update.incidentType === scope.incidentType;
            const normalizedEvent = {
              ...event,
              data: { ...update, cityId: event.data.cityId },
            };

            if (matchesType && eventIsVisible(normalizedEvent, scope)) {
              useRealtimeUiStore.getState().addNotification({
                event: normalizedEvent,
                scope: "visible",
              });
            } else {
              useRealtimeUiStore.getState().addNotification({
                event: normalizedEvent,
                scope: "external",
              });
            }
          }
          return;
        }

        if (
          ["incident.community_confirmed", "incident.admin_verified"].includes(
            event.type,
          )
        ) {
          if (event.data?.cityId === scope.cityId) {
            invalidateRollingData(queryClient, scope);
          }
          useRealtimeUiStore.getState().addNotification({
            event,
            scope: eventIsVisible(event, scope) ? "visible" : "external",
          });
        }
      },
    });

    return () => channel.close();
  }, [queryClient]);

  return children;
}
