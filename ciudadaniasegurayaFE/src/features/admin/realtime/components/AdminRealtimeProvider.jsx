"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAdminSession } from "../../auth/components/AdminSessionProvider";
import { createAdminSseClient } from "../services/admin-sse-client";
import { useAdminRealtimeStore } from "../state/admin-realtime.store";

export function AdminRealtimeProvider({ children }) {
  const queryClient = useQueryClient();
  const { status } = useAdminSession();

  useEffect(() => {
    if (status !== "authenticated") return undefined;
    const channel = createAdminSseClient({
      onStatus: useAdminRealtimeStore.getState().setStatus,
      onEvent(event) {
        useAdminRealtimeStore.getState().receive(event);
        void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
        if (event.type.startsWith("admin.incident.")) {
          void queryClient.invalidateQueries({ queryKey: ["admin", "incidents"] });
        }
        if (event.type.startsWith("admin.user.")) {
          void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
        }
        if (event.type === "admin.role.updated") {
          void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
          void queryClient.invalidateQueries({ queryKey: ["admin", "administrators"] });
        }
        if (event.type.startsWith("admin.request.")) {
          void queryClient.invalidateQueries({ queryKey: ["admin", "admin-requests"] });
        }
        if (event.type === "admin.content.moderated") {
          void queryClient.invalidateQueries({ queryKey: ["admin", "posts"] });
          void queryClient.invalidateQueries({ queryKey: ["admin", "comments"] });
        }
      },
    });
    return () => channel.close();
  }, [queryClient, status]);

  return children;
}
