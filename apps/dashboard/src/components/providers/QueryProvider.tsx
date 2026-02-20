"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * TanStack Query provider — wraps the entire app.
 * Configured for dashboard polling needs:
 * - staleTime: 30s (KPIs data)
 * - refetchOnWindowFocus: true (live data freshness)
 * - retry: 1 (don't hammer a failing backend)
 */
export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 30 * 1000,      // 30 seconds
                        gcTime: 5 * 60 * 1000,     // 5 minutes garbage collection
                        retry: 1,
                        refetchOnWindowFocus: true,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}
