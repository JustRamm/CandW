import { QueryClient } from "@tanstack/react-query";

// High-performance caching defaults:
// - 60s staleTime prevents continuous refetching on tab/route changes
// - 10m gcTime keeps inactive page data cached in memory for instant navigation
// - refetchOnWindowFocus: false prevents jarring UI refreshes on window focus
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});
