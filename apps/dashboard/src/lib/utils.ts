import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes safely (handles conditional classes + deduplication)
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format a number as XAF currency
 */
export function formatXAF(amount: number): string {
    return new Intl.NumberFormat("fr-CM", {
        style: "currency",
        currency: "XAF",
        maximumFractionDigits: 0,
    }).format(amount);
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
