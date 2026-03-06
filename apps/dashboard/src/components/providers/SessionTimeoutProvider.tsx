"use client";

import { useEffect, useCallback, useRef } from "react";
import { signOut, useSession } from "next-auth/react";

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleSignOut = useCallback(() => {
        if (session) {
            console.log("[SessionTimeout] Idle timeout reached. Signing out...");
            signOut({ callbackUrl: "/login" });
        }
    }, [session]);

    const resetTimeout = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        if (session) {
            timeoutRef.current = setTimeout(handleSignOut, IDLE_TIMEOUT);
        }
    }, [session, handleSignOut]);

    useEffect(() => {
        if (!session) return;

        // User events to listen for
        const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];

        const eventHandler = () => resetTimeout();

        // Initialize timeout
        resetTimeout();

        // Listen for user activity
        events.forEach((event) => {
            window.addEventListener(event, eventHandler);
        });

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            events.forEach((event) => {
                window.removeEventListener(event, eventHandler);
            });
        };
    }, [session, resetTimeout]);

    return <>{children}</>;
}
