import { api } from "@/lib/api";

/** Analyse financière (ADR-0019, D4-D5) : revenus, entonnoir et échecs. */
export interface Share { key: string; label: string; gross: number; count: number; share: number }
export interface RevenueReport {
    period: { start: string; end: string };
    fx: { available: boolean; asOf?: string; source?: string; pivot?: string };
    referenceCurrency: string;
    totals: {
        count: number;
        byCurrency: Array<{ currency: string; gross: number; fees: number; net: number; count: number; avg: number }>;
        reference: { gross: number; fees: number; net: number; avg: number; unconverted: number };
    };
    previous: { gross: number; count: number };
    series: Array<{ date: string; gross: number; count: number }>;
    breakdown: Record<"country" | "provider" | "method" | "product" | "channel", Share[]>;
    topFormations: Share[];
    discounts: { total: number; count: number; byFunder: Record<string, number> };
}
export interface Rate { key: string; label: string; total: number; succeeded: number; failed: number; abandoned: number; successRate: number | null }
export interface FailureCategory {
    category: string; label: string; explanation: string; action: string; owner: string; tone: "warning" | "danger" | "neutral";
    count: number; share: number; amountAtRisk: number; providers: Record<string, number>;
    examples: Array<{ reference: string | null; provider: string | null; amount: number; currency: string; at: string; errorCode: string | null; errorMessage: string | null; country: string }>;
}
export interface FailuresReport {
    period: { start: string; end: string };
    referenceCurrency: string;
    abandonAfterMinutes: number;
    funnel: { created: number; attempted: number; succeeded: number; failed: number; abandoned: number; pending: number };
    rates: { success: number | null; abandonment: number | null; failure: number | null };
    medianTimeToPaySeconds: number | null;
    failover: { intentsWithSeveralAttempts: number; recoveredByFailover: number };
    categories: FailureCategory[];
    byProvider: Rate[]; byCountry: Rate[]; byMethod: Rate[];
}
export interface PeriodQuery { range: string; ref: string }

export const financeApi = {
    revenue: (q: PeriodQuery) => api.get("/finance/revenue", { params: q }).then((r) => r.data.data as RevenueReport),
    failures: (q: PeriodQuery) => api.get("/finance/failures", { params: q }).then((r) => r.data.data as FailuresReport),
};

export const RANGES = [{ id: "7d", label: "7 jours" }, { id: "30d", label: "30 jours" }, { id: "90d", label: "90 jours" }, { id: "12m", label: "12 mois" }];
export const REFERENCE_CURRENCIES = ["XOF", "XAF", "EUR", "USD"];
