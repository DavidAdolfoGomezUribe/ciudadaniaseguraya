"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { AdminSessionProvider } from "@/features/admin/auth/components/AdminSessionProvider";
import { AdminRealtimeProvider } from "@/features/admin/realtime/components/AdminRealtimeProvider";
import { createAdminQueryClient } from "@/lib/query/admin-query-client";

export function AdminProviders({ children }) {
  const [queryClient] = useState(createAdminQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <AdminSessionProvider queryClient={queryClient}>
        <AdminRealtimeProvider>{children}</AdminRealtimeProvider>
      </AdminSessionProvider>
    </QueryClientProvider>
  );
}
