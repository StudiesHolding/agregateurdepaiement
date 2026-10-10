/** Formats communs de l'espace finance : pays, devises, moyens de paiement (français). */

const regions = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["fr"], { type: "region" }) : null;

export function countryName(code: string | null | undefined): string {
    if (!code) return "Pays inconnu";
    if (code === "*") return "Tous les pays";
    try { return regions?.of(code.toUpperCase()) ?? code; } catch { return code; }
}

const ZERO_DECIMALS = new Set(["XOF", "XAF", "GNF", "RWF", "UGX", "KMF", "JPY"]);
export function money(amount: number | string | null | undefined, currency: string): string {
    const v = Number(amount ?? 0);
    try {
        return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: ZERO_DECIMALS.has(currency) ? 0 : 2 }).format(v);
    } catch {
        return `${v.toLocaleString("fr-FR")} ${currency}`;
    }
}

export const compact = (v: number) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(v);
export const percent = (v: number | null | undefined, digits = 1) => (v == null || Number.isNaN(v) ? "—" : `${v.toLocaleString("fr-FR", { maximumFractionDigits: digits })} %`);

export type PaymentMethod = "card" | "mobile_money";
export type RuleMethod = PaymentMethod | "any";
export const METHOD_LABELS: Record<RuleMethod, string> = { card: "Carte bancaire", mobile_money: "Mobile Money", any: "Tous les moyens" };

/** Pays de la zone de Studies Learning proposés en premier dans les listes. */
export const PRIORITY_COUNTRIES = ["CM", "CI", "SN", "BJ", "TG", "BF", "ML", "NE", "GA", "CG", "CD", "GN", "TD", "CF", "GQ", "MG", "RW", "FR", "BE", "CA", "US"];
export const CURRENCIES = ["XOF", "XAF", "EUR", "USD", "GNF", "CDF", "RWF", "MGA", "CAD", "GBP", "NGN", "GHS"];
