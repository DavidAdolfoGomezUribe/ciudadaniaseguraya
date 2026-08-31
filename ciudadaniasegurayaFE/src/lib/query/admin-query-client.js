import { QueryClient } from "@tanstack/react-query";

export function createAdminQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 20_000,
        gcTime: 5 * 60_000,
        retry(failureCount, error) {
          if ([400, 401, 403, 404, 409, 422].includes(error?.status)) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: true,
        refetchOnMount: true,
      },
      mutations: { retry: false },
    },
  });
}
