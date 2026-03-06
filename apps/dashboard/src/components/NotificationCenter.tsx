"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Bell, CheckCircle2, AlertTriangle, XCircle, Info, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useAudioNotifications } from "@/hooks/use-audio-notifications";

export function NotificationCenter() {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const { playSound } = useAudioNotifications();

    const { data: notifications = [] } = useQuery({
        queryKey: ["admin-notifications"],
        queryFn: () => adminApi.getAdminNotifications().then((r) => r.data.data),
        refetchInterval: 10000, // Refresh every 10s
    });

    const unreadCount = notifications.filter((n: any) => !n.isRead).length;

    // Play sound when new notifications arrive
    const [lastCount, setLastCount] = useState(unreadCount);
    useEffect(() => {
        if (unreadCount > lastCount) {
            const latest = notifications.find((n: any) => !n.isRead);
            if (latest) playSound(latest.type as any);
        }
        setLastCount(unreadCount);
    }, [unreadCount, notifications, lastCount, playSound]);

    const markAsReadMutation = useMutation({
        mutationFn: (id: number) => adminApi.markNotificationAsRead(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
    });

    const clearAllMutation = useMutation({
        mutationFn: () => adminApi.clearAllNotifications(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] }),
    });

    const getIcon = (type: string) => {
        switch (type) {
            case "SUCCESS": return <CheckCircle2 size={16} className="text-success" />;
            case "DANGER": return <XCircle size={16} className="text-danger" />;
            case "WARNING": return <AlertTriangle size={16} className="text-warning-dark" />;
            default: return <Info size={16} className="text-primary" />;
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="btn-ghost p-2 rounded-xl relative"
                title="Notifications"
            >
                <Bell size={16} />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-danger text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-3 w-80 max-h-[500px] bg-white dark:bg-surface border border-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-up flex flex-col">
                        <div className="p-4 border-b border-border flex items-center justify-between bg-background/50">
                            <h3 className="text-sm font-bold text-text-main">Système Alerts</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={() => clearAllMutation.mutate()}
                                    className="text-[10px] font-black uppercase text-primary hover:underline"
                                >
                                    Tout marquer lu
                                </button>
                            )}
                        </div>

                        <div className="overflow-y-auto flex-1 scroll-area py-2">
                            {notifications.length === 0 ? (
                                <div className="p-8 text-center opacity-40 italic text-xs">
                                    Aucune notification
                                </div>
                            ) : (
                                notifications.map((n: any) => (
                                    <div
                                        key={n.id}
                                        className={cn(
                                            "px-4 py-3 flex gap-3 hover:bg-background/50 transition-colors cursor-pointer border-l-4",
                                            n.isRead ? "border-transparent opacity-60" : "border-primary bg-primary/5"
                                        )}
                                        onClick={() => !n.isRead && markAsReadMutation.mutate(n.id)}
                                    >
                                        <div className="mt-0.5">{getIcon(n.type)}</div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-text-main leading-tight mb-0.5">{n.title}</p>
                                            <p className="text-[10px] text-text-light leading-snug line-clamp-2">{n.message}</p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-[9px] text-text-light/60 font-medium">
                                                    {new Date(n.created_at).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {n.orderReference && (
                                                    <Link
                                                        href={`/orders/${n.id}`}
                                                        className="text-[9px] font-black uppercase text-primary flex items-center gap-0.5"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        Détails <ExternalLink size={8} />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-3 border-t border-border bg-background/30 text-center">
                            <Link
                                href="/settings/notifications"
                                className="text-[10px] font-bold text-text-light hover:text-primary transition-colors"
                                onClick={() => setIsOpen(false)}
                            >
                                Paramètres de notification
                            </Link>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
