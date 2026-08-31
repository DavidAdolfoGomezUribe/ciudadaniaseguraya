import { QueryClient } from "@tanstack/react-query";

export const PUBLIC_STALE_TIME = 10 * 60 * 1000;
export const PUBLIC_GC_TIME = 24 * 60 * 60 * 1000;

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: PUBLIC_STALE_TIME,
        gcTime: PUBLIC_GC_TIME,
        retry(failureCount, error) {
          if ([400, 401, 403, 404, 422].includes(error?.status)) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchInterval: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
