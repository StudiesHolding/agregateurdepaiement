import { api } from "@/lib/api";
import type { PaymentMethod } from "@/lib/format";

/** Prestataires de paiement (ADR-0019, D3) : fiche, catalogue, réglages. */
export interface Credential { env: string; label: string; present: boolean }
export interface Readiness {
    implemented: boolean; ready: boolean; credentials: Credential[]; optional: Credential[];
    mode: "test" | "live" | null; webhookPath: string | null; verification: string | null;
}
export interface Fee { percent: number; fixed: number; currency: string | null }
export type HealthStatus = "operational" | "degraded" | "critical" | "idle" | "inactive" | "maintenance" | "not_configured";
export interface ProviderSheet {
    id: number; code: string; name: string; isActive: boolean; supportCard: boolean; supportMobileMoney: boolean;
    inMaintenance: boolean; maintenance: { active: boolean; reason?: string; until?: string | null; since?: string };
    fees: Partial<Record<PaymentMethod, Fee>>; settlementDays: number | null; note: string | null;
    readiness: Readiness;
    stats: { totalAttempts: number; successCount: number; failureCount: number; successRate: number | null; healthStatus: HealthStatus };
    coverage: { rules: number; activeRules: number; countries: string[]; currencies: string[] };
}
export interface CatalogEntry { code: string; name: string; methods: PaymentMethod[]; registered: boolean; readiness: Readiness }
export interface SettingsInput {
    name?: string; maintenance?: { active: boolean; reason?: string; until?: string | null };
    fees?: Partial<Record<PaymentMethod, { percent: number; fixed: number; currency?: string | null }>>; settlementDays?: number; note?: string | null;
}

export const providersApi = {
    list: (period: string) => api.get("/providers", { params: { period } }).then((r) => r.data.data as ProviderSheet[]),
    catalog: () => api.get("/providers/catalog").then((r) => r.data.data as CatalogEntry[]),
    create: (code: string) => api.post("/providers", { code }).then((r) => r.data.data as ProviderSheet),
    update: (id: number, input: SettingsInput) => api.put(`/providers/${id}`, input).then((r) => r.data.data as ProviderSheet),
    toggle: (id: number) => api.put(`/providers/${id}/toggle`).then((r) => r.data as { data: ProviderSheet; message: string }),
    test: (id: number) => api.post(`/providers/${id}/test`).then((r) => r.data as { status: string; message: string; data: { ok: boolean; checks: Array<{ label: string; ok: boolean; detail?: string }>; mode: string | null } }),
    sparkline: (id: number) => api.get(`/providers/${id}/sparkline`).then((r) => r.data.data as Array<{ hour: string; total: number; successes: number; successRate: number }>),
    errors: (id: number, period: string) => api.get(`/providers/${id}/errors`, { params: { period } }).then((r) => r.data.data as Array<{ errorCode: string; errorMessage: string; occurrences: number }>),
};

export const HEALTH: Record<HealthStatus, { label: string; badge: string }> = {
    operational: { label: "Opérationnel", badge: "badge-success" },
    degraded: { label: "Dégradé", badge: "badge-warning" },
    critical: { label: "Critique", badge: "badge-danger" },
    idle: { label: "Sans trafic", badge: "badge-primary" },
    inactive: { label: "Désactivé", badge: "badge-neutral" },
    maintenance: { label: "Maintenance", badge: "badge-warning" },
    not_configured: { label: "Identifiants manquants", badge: "badge-danger" },
};
