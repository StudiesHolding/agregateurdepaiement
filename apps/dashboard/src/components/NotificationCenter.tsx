"use client";

/**
 * Centre de notifications (ADR-0019, D7) : alertes produites par les règles de notification. Un signal sonore
 * accompagne une nouvelle alerte quand sa règle le demande ; chaque alerte mène à son action.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Info, Settings2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { metaOf, notificationsApi, playTone, type InAppNotification } from "@/lib/notifications";

const ICON: Record<InAppNotification["type"], JSX.Element> = {
    SUCCESS: <CheckCircle2 size={16} className="text-success" />,
    DANGER: <XCircle size={16} className="text-danger" />,
    WARNING: <AlertTriangle size={16} className="text-warning" />,
    INFO: <Info size={16} className="text-primary" />,
};

const when = (n: InAppNotification) => {
    const d = new Date(n.createdAt ?? n.created_at ?? "");
    if (Number.isNaN(d.getTime())) return "";
    const today = new Date().toDateString() === d.toDateString();
    return d.toLocaleString("fr-FR", today ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

export function NotificationCenter() {
    const qc = useQueryClient();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const { data = [] } = useQuery({ queryKey: ["admin-notifications"], queryFn: notificationsApi.inbox, refetchInterval: 30_000 });
    const visible = data.filter((n) => metaOf(n).inApp !== false);
    const unread = visible.filter((n) => !n.isRead);

    // Son : seulement pour une alerte NOUVELLE (identifiant jamais vu) dont la règle demande le son.
    const seen = useRef<Set<number> | null>(null);
    useEffect(() => {
        if (seen.current === null) { seen.current = new Set(data.map((n) => n.id)); return; }
        const fresh = data.filter((n) => !seen.current!.has(n.id) && !n.isRead);
        fresh.forEach((n) => seen.current!.add(n.id));
        const loud = fresh.find((n) => metaOf(n).sound);
        if (loud) playTone(loud.type);
    }, [data]);

    const refresh = () => qc.invalidateQueries({ queryKey: ["admin-notifications"] });
    const markRead = useMutation({ mutationFn: (id: number) => notificationsApi.markRead(id), onSuccess: refresh });
    const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: refresh });

    const openItem = (n: InAppNotification) => {
        if (!n.isRead) markRead.mutate(n.id);
        const href = metaOf(n).href ?? (n.orderReference ? `/transactions?search=${encodeURIComponent(n.orderReference)}` : null);
        if (href) { setOpen(false); router.push(href); }
    };

    return (
        <div className="relative">
            <button type="button" onClick={() => setOpen((v) => !v)} className="btn-ghost relative rounded-xl p-2" aria-label={`Notifications${unread.length ? ` (${unread.length} non lues)` : ""}`} aria-expanded={open}>
                <Bell size={16} />
                {unread.length > 0 && (
                    <span className={cn("absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white", unread.some((n) => n.type === "DANGER") ? "bg-danger" : "bg-primary")}>
                        {unread.length > 9 ? "9+" : unread.length}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 z-50 mt-3 flex max-h-[520px] w-96 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card-hover animate-slide-up" role="dialog" aria-label="Notifications">
                        <div className="flex items-center justify-between border-b border-border px-4 py-3">
                            <h3 className="text-sm font-bold text-text-main">Alertes de l’espace finance</h3>
                            {unread.length > 0 && <button type="button" onClick={() => markAll.mutate()} className="text-xs font-semibold text-primary hover:underline">Tout marquer lu</button>}
                        </div>
                        <div className="flex-1 overflow-y-auto scroll-area py-1">
                            {visible.length === 0 ? (
                                <p className="flex flex-col items-center gap-2 p-8 text-center text-xs text-text-light"><CheckCircle2 size={20} className="text-success" />Aucune alerte.</p>
                            ) : visible.map((n) => (
                                <button
                                    key={n.id}
                                    type="button"
                                    onClick={() => openItem(n)}
                                    className={cn("flex w-full gap-3 border-l-4 px-4 py-3 text-left transition-colors hover:bg-background", n.isRead ? "border-transparent opacity-70" : n.type === "DANGER" ? "border-danger bg-danger-light/30" : "border-primary bg-primary/5")}
                                >
                                    <span className="mt-0.5">{ICON[n.type] ?? ICON.INFO}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="mb-0.5 block text-xs font-bold leading-tight text-text-main">{n.title}</span>
                                        <span className="line-clamp-3 block text-[11px] leading-snug text-text-light">{n.message}</span>
                                        <span className="mt-1.5 flex items-center justify-between text-[10px] text-text-light">
                                            {when(n)}
                                            {(metaOf(n).href || n.orderReference) && <span className="flex items-center gap-0.5 font-semibold text-primary">Ouvrir <ArrowRight size={10} /></span>}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-border px-4 py-2.5 text-center">
                            <Link href="/settings/notifications" onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-xs font-semibold text-text-light hover:text-primary"><Settings2 size={12} />Régler les notifications</Link>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
