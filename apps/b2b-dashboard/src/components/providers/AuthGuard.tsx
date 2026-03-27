"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Client-side authentication guard
 * Complements middleware protection by checking token after mount
 * This ensures consistent rendering and eliminates hydration warnings
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        // Check for token in localStorage or cookie
        const token = localStorage.getItem("b2b_token");

        // Also check cookie for middleware-synced token
        const cookies = document.cookie.split(";");
        const hasCookieToken = cookies.some((c) => c.trim().startsWith("b2b_token="));

        if (!token && !hasCookieToken) {
            // No valid token, redirect to login
            const locale = window.location.pathname.split("/")[1] || "fr";
            router.push(`/${locale}/login`);
            return;
        }

        setIsChecking(false);
    }, [router]);

    // Show nothing while checking (prevents flash)
    if (isChecking) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return <>{children}</>;
}
