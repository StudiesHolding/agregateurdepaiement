import { api } from "@/lib/api";

/** Notifications de l'espace finance (ADR-0019, D7) : règles, catalogue, journal d'envoi, centre de notifications. */
export type Severity = "info" | "warning" | "danger";
export interface ParamSpec { label: string; type: "number" | "currency"; min?: number; max?: number; default: number | string }
export interface CatalogEvent { event: string; kind: "instant" | "watch"; label: string; severity: Severity; description: string; params: Record<string, ParamSpec> }
export interface Rule {
    id: number; event: string; name: string | null; enabled: boolean; severity: Severity; params: Record<string, number | string>;
    channels: { inApp?: boolean; email?: boolean; sound?: boolean }; recipients: { emails: string[] };
    quietHours: { from: string; to: string; allowDanger: boolean } | null; timezone: string; cooldownMinutes: number;
    updatedBy: string | null; updatedAt: string;
}
export type RuleInput = Partial<Omit<Rule, "id" | "updatedBy" | "updatedAt">>;
export interface Delivery { id: number; ruleId: number | null; event: string; channel: "inApp" | "email" | "sound"; recipient: string | null; status: "sent" | "skipped" | "failed"; title: string; detail: string | null; createdAt: string }
export interface InAppNotification {
    id: number; type: "SUCCESS" | "DANGER" | "WARNING" | "INFO"; title: string; message: string; orderReference: string | null; isRead: boolean;
    metadata: { event?: string; href?: string | null; sound?: boolean; inApp?: boolean } | string | null; createdAt?: string; created_at?: string;
}

export const notificationsApi = {
    catalog: () => api.get("/notification-catalog").then((r) => r.data.data as CatalogEvent[]),
    rules: () => api.get("/notification-rules").then((r) => r.data.data as Rule[]),
    create: (input: RuleInput) => api.post("/notification-rules", input).then((r) => r.data.data as Rule),
    update: (id: number, input: RuleInput) => api.put(`/notification-rules/${id}`, input).then((r) => r.data.data as Rule),
    remove: (id: number) => api.delete(`/notification-rules/${id}`).then(() => undefined),
    test: (id: number) => api.post(`/notification-rules/${id}/test`).then((r) => r.data as { message: string }),
    deliveries: (limit = 100) => api.get("/notification-deliveries", { params: { limit } }).then((r) => r.data.data as Delivery[]),
    inbox: () => api.get("/admin-notifications").then((r) => r.data.data as InAppNotification[]),
    markRead: (id: number) => api.put(`/admin-notifications/${id}/read`),
    markAllRead: () => api.put("/admin-notifications/read-all"),
};

export const metaOf = (n: InAppNotification) => {
    if (!n.metadata) return {};
    if (typeof n.metadata === "string") { try { return JSON.parse(n.metadata); } catch { return {}; } }
    return n.metadata;
};

/**
 * Signal sonore généré dans le navigateur (aucun fichier) : grave et répété pour l'urgent, doux pour l'information.
 * Le navigateur n'autorise le son qu'après une première interaction avec la page.
 */
export function playTone(type: InAppNotification["type"]) {
    try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const notes: Record<string, number[]> = { DANGER: [440, 330, 440, 330], WARNING: [660, 520], SUCCESS: [523, 659, 784], INFO: [880] };
        (notes[type] ?? notes.INFO).forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type === "DANGER" ? "square" : "sine";
            osc.frequency.value = freq;
            const t = ctx.currentTime + i * 0.16;
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(type === "DANGER" ? 0.08 : 0.12, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.15);
        });
        setTimeout(() => ctx.close(), 1200);
    } catch { /* son indisponible : sans conséquence */ }
}
