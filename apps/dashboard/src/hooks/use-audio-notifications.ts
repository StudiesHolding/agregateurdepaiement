"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";

type SoundType = "SUCCESS" | "DANGER" | "WARNING" | "INFO";

export function useAudioNotifications() {
    // Check user preference for sound
    const { data: settings = [] } = useQuery({
        queryKey: ["notifications"],
        queryFn: () => adminApi.getNotifications().then((r) => r.data.data),
    });

    // Determine if sound is enabled (at least for one configured email)
    const isSoundEnabled = settings.some((s: any) => s.isActive && s.notifyWithSound);

    const playSound = useCallback((type: SoundType) => {
        if (!isSoundEnabled) return;

        const sounds: Record<SoundType, string> = {
            SUCCESS: "/sounds/success.mp3",
            DANGER: "/sounds/error.mp3",
            WARNING: "/sounds/alert.mp3",
            INFO: "/sounds/info.mp3",
        };

        const audio = new Audio(sounds[type]);
        audio.play().catch((err) => console.warn("Audio playback failed:", err));
    }, [isSoundEnabled]);

    return { playSound };
}
