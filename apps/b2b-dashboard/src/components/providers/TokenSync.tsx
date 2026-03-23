"use client";

import { useEffect } from "react";

/**
 * Component to sync authentication token from localStorage to cookie
 * This ensures the middleware can detect authenticated users
 */
export function TokenSync() {
    useEffect(() => {
        try {
            // Sync token from localStorage to cookie on initial load
            const token = localStorage.getItem("b2b_token");
            if (token && typeof document !== "undefined") {
                // Check if cookie already exists
                const cookies = document.cookie.split(";");
                const hasTokenCookie = cookies.some((c) => c.trim().startsWith("b2b_token="));

                if (!hasTokenCookie) {
                    document.cookie = `b2b_token=${token}; path=/; max-age=2592000; SameSite=Strict`;
                }
            }
        } catch (e) {
            // Silently fail if localStorage or cookies are unavailable (e.g., private browsing)
        }
    }, []);

    return null;
}