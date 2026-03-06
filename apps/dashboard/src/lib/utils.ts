import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes safely (handles conditional classes + deduplication)
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format a number as dynamic currency
 */
export function formatCurrency(amount: number, currency: string = "XAF"): string {
    const locale = currency === "XAF" || currency === "XOF" ? "fr-CM" : "fr-FR";
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency,
        maximumFractionDigits: currency === "XAF" || currency === "XOF" ? 0 : 2,
    }).format(amount);
}

/**
 * Format a number as XAF currency (Legacy wrapper)
 */
export function formatXAF(amount: number): string {
    return formatCurrency(amount, "XAF");
}

/**
 * Format a number with compact notation (1.2M, 45K, etc.)
 */
export function formatCompact(value: number): string {
    return new Intl.NumberFormat("fr-FR", {
        notation: "compact",
        compactDisplay: "short",
    }).format(value);
}

/**
 * Format a percentage with sign
 */
export function formatTrend(trend: number): string {
    const sign = trend > 0 ? "+" : "";
    return `${sign}${trend.toFixed(1)}%`;
}

/**
 * Return Tailwind classes for a provider health status
 */
export function healthStatusColor(status: string): string {
    const map: Record<string, string> = {
        operational: "text-operational",
        degraded: "text-degraded",
        critical: "text-critical",
        idle: "text-idle",
        inactive: "text-inactive",
    };
    return map[status] ?? "text-text-light";
}

/**
 * Return label for a health status
 */
export function healthStatusLabel(status: string): string {
    const map: Record<string, string> = {
        operational: "Opérationnel",
        degraded: "Dégradé",
        critical: "Critique",
        idle: "Inactif (idle)",
        inactive: "Désactivé",
    };
    return map[status] ?? status;
}
