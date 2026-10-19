import { api } from "@/lib/api";
import type { PaymentMethod, RuleMethod } from "@/lib/format";

/** Règles de priorité (ADR-0019, D2) : types et appels de l'API du PSP. */
export interface RuleProvider { id: number; name: string; code: string; isActive: boolean; inMaintenance: boolean }
export interface Rule {
    id: number; provider: RuleProvider | null; countryCode: string; currency: string; paymentMethod: RuleMethod;
    minAmount: number | null; maxAmount: number | null; priority: number; isActive: boolean; updatedAt?: string;
}
export interface Lane { countryCode: string; currency: string; paymentMethod: RuleMethod; rules: Rule[] }
export interface MatrixProvider { id: number; name: string; code: string; isActive: boolean; supportCard: boolean; supportMobileMoney: boolean; inMaintenance: boolean }
export interface RuleInput { providerId?: number; countryCode: string; currency: string; paymentMethod: RuleMethod; minAmount: number | null; maxAmount: number | null; priority: number; isActive?: boolean }
export interface TraceLine { ruleId: number; provider: string; status: "selected" | "fallback" | "excluded" | "shadowed"; reason: string }
export interface Simulation {
    input: { countryCode: string | null; currency: string; amount: number; paymentMethod: PaymentMethod };
    selectedProvider: { position: number; ruleId: number; providerName: string; providerCode: string; priority: number; why: string } | null;
    fallbackChain: Array<{ position: number; ruleId: number; providerName: string; providerCode: string; priority: number; why: string }>;
    totalCandidates: number;
    trace: TraceLine[];
}

export const routingApi = {
    matrix: () => api.get("/routes/matrix").then((r) => r.data.data as { lanes: Lane[]; providers: MatrixProvider[] }),
    create: (input: RuleInput) => api.post("/routes", input).then((r) => r.data.data as Rule),
    update: (id: number, input: Partial<RuleInput>) => api.put(`/routes/${id}`, input).then((r) => r.data.data as Rule),
    remove: (id: number) => api.delete(`/routes/${id}`).then(() => undefined),
    reorder: (ruleIds: number[]) => api.put("/routes-order", { ruleIds }).then((r) => r.data.data as Array<{ id: number; priority: number }>),
    simulate: (input: { countryCode: string; currency: string; amount: number; paymentMethod: PaymentMethod }) => api.post("/routes/simulate", input).then((r) => r.data.data as Simulation),
};

/** Une règle peut-elle réellement servir ? (règle et prestataire actifs, pas de maintenance) */
export const isUsable = (r: Rule) => r.isActive && !!r.provider?.isActive && !r.provider?.inMaintenance;
