/**
 * Marque Studies Learning (ADR-0019, D1) : blason d'origine (encre violette en clair, blanc en sombre) et nom du produit.
 * Le blason suit le thème par la classe `dark` ; aucune couleur n'est recomposée à la main.
 */
import { cn } from "@/lib/utils";

export function Blason({ size = 36, className }: { size?: number; className?: string }) {
    const h = Math.round(size * 0.772); // proportions du blason (659.6 × 509.24)
    return (
        <span className={cn("inline-flex shrink-0", className)} style={{ width: size, height: h }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/blason.svg" alt="" aria-hidden width={size} height={h} className="block dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/blason-blanc.svg" alt="" aria-hidden width={size} height={h} className="hidden dark:block" />
        </span>
    );
}

export function BrandMark({ subtitle = "Paiements", compact = false }: { subtitle?: string; compact?: boolean }) {
    return (
        <span className="inline-flex items-center gap-2.5" aria-label={`Studies Learning, ${subtitle}`}>
            <Blason size={compact ? 30 : 38} />
            <span className="leading-tight">
                <span className="block text-[15px] font-bold tracking-tight text-[#4B0082] dark:text-white">Studies Learning</span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{subtitle}</span>
            </span>
        </span>
    );
}
