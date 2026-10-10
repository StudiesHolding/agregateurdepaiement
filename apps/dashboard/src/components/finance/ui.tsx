"use client";

/** Éléments partagés de l'espace finance : sélecteurs de période et de devise, barres de répartition, tuiles. */
import { cn } from "@/lib/utils";
import { RANGES, REFERENCE_CURRENCIES } from "@/lib/finance";
import type { ReactNode } from "react";

export function PeriodControls({ range, onRange, currency, onCurrency }: { range: string; onRange: (r: string) => void; currency?: string; onCurrency?: (c: string) => void }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="Période">
                {RANGES.map((x) => (
                    <button key={x.id} type="button" role="tab" aria-selected={range === x.id} onClick={() => onRange(x.id)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", range === x.id ? "bg-primary text-white" : "text-text-light hover:text-text-main")}>{x.label}</button>
                ))}
            </div>
            {currency && onCurrency && (
                <label className="flex items-center gap-2 text-xs font-semibold text-text-light">
                    Équivalent en
                    <select className="input w-auto py-1.5" value={currency} onChange={(e) => onCurrency(e.target.value)} aria-label="Devise de référence">
                        {REFERENCE_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                </label>
            )}
        </div>
    );
}

export function Tile({ label, value, hint, icon, tone = "text-text-main" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: string }) {
    return (
        <div className="card p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-text-light">{label}{icon}</div>
            <p className={cn("mt-2 break-words text-xl font-bold tracking-tight 2xl:text-2xl", tone)}>{value}</p>
            {hint && <p className="mt-1 text-xs text-text-light">{hint}</p>}
        </div>
    );
}

/** Répartition en barres horizontales (une seule teinte, part en %, valeur au survol). */
export function BarList({ items, format, empty = "Aucune donnée sur la période." }: { items: Array<{ key: string; label: string; value: number; sub?: string }>; format: (v: number) => string; empty?: string }) {
    const max = Math.max(0, ...items.map((i) => i.value));
    if (!items.length) return <p className="text-xs text-text-light">{empty}</p>;
    return (
        <ul className="space-y-2">
            {items.map((i) => (
                <li key={i.key} title={`${i.label} : ${format(i.value)}${i.sub ? ` · ${i.sub}` : ""}`}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-text-main">{i.label}</span>
                        <span className="shrink-0 tabular-nums text-text-light">{format(i.value)}{i.sub ? ` · ${i.sub}` : ""}</span>
                    </div>
                    <div className="h-2 rounded-full bg-background">
                        <div className="h-2 rounded-full bg-primary transition-[width] duration-700" style={{ width: `${max ? Math.max(2, (i.value / max) * 100) : 0}%` }} />
                    </div>
                </li>
            ))}
        </ul>
    );
}

export function Panel({ title, subtitle, children, aside, className }: { title: string; subtitle?: string; children: ReactNode; aside?: ReactNode; className?: string }) {
    return (
        <section className={cn("card p-5", className)}>
            <header className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-sm font-bold text-text-main">{title}</h2>
                    {subtitle && <p className="text-xs text-text-light">{subtitle}</p>}
                </div>
                {aside}
            </header>
            {children}
        </section>
    );
}
