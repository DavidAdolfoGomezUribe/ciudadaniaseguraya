"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";

import { AuthProvider } from "@/features/auth/components/AuthProvider";
import { RealtimeProvider } from "@/features/realtime/components/RealtimeProvider";
import { createAppQueryClient } from "@/lib/query/query-client";
import { createIndexedDbPersister } from "@/lib/query/indexed-db-persister";

export function AppProviders({ children }) {
  const [queryClient] = useState(createAppQueryClient);
  const [persister] = useState(() => createIndexedDbPersister(queryClient));

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: `${process.env.NEXT_PUBLIC_CACHE_VERSION || "1"}:${
          process.env.NEXT_PUBLIC_CACHE_BUILD_ID || "local"
        }`,
        dehydrateOptions: {
          shouldDehydrateQuery(query) {
            return query.state.status === "success" && query.meta?.persist === true;
          },
        },
      }}
    >
      <AuthProvider>
        <RealtimeProvider>{children}</RealtimeProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
