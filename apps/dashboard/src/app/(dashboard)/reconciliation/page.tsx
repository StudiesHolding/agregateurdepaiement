"use client";

/**
 * Rapprochement (ADR-0019, D6)
 * ============================
 * Paiements confirmés ↔ commandes ↔ accès livrés ↔ notifications des prestataires. Chaque écart est un client payé
 * sans être servi, un accès sans paiement, ou une notification qui n'a pas abouti — avec la marche à suivre.
 */
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, AlertTriangle, CheckCircle2, Lightbulb, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
import { overviewApi, type ReconciliationGroup } from "@/lib/finance";

const WINDOWS = [7, 30, 90];

function Group({ g }: { g: ReconciliationGroup }) {
    return (
        <section className={cn("card p-5", g.severity === "danger" ? "border-danger/30" : "border-warning/30")}>
            <header className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold text-text-main">
                    {g.severity === "danger" ? <AlertOctagon size={16} className="text-danger" /> : <AlertTriangle size={16} className="text-warning" />}{g.label}
                </h2>
                <span className={cn("badge", g.severity === "danger" ? "badge-danger" : "badge-warning")}>{g.count}</span>
            </header>
            <p className="mt-2 text-xs text-text-main">{g.explanation}</p>
            <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-background px-3 py-2 text-xs text-text-main"><Lightbulb size={13} className="mt-0.5 shrink-0 text-primary" />{g.action}</p>
            <div className="mt-3 overflow-x-auto">
                <table className="data-table w-full text-xs">
                    <thead><tr><th>Référence</th><th>Date</th><th>Détail</th><th className="text-right">Montant</th></tr></thead>
                    <tbody>
                        {g.items.map((it, i) => (
                            <tr key={`${it.reference ?? it.webhookId ?? it.transactionNumber}-${i}`}>
                                <td className="font-mono">
                                    {it.orderId ? <Link href={`/orders/${it.orderId}`} className="font-semibold text-primary">{it.reference}</Link>
                                        : it.webhookId ? <Link href="/webhooks" className="font-semibold text-primary">Notification n° {it.webhookId}</Link>
                                        : it.reference ? <Link href={`/transactions?search=${encodeURIComponent(it.reference)}`} className="font-semibold text-primary">{it.reference}</Link>
                                        : it.transactionNumber}
                                </td>
                                <td>{new Date(it.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                                <td className="text-text-light">{[it.status && `état : ${it.status}`, it.provider, it.reason].filter(Boolean).join(" · ") || "—"}</td>
                                <td className="text-right tabular-nums">{it.amount != null && it.currency ? money(it.amount, it.currency) : "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {g.count > g.items.length && <p className="mt-2 text-[11px] text-text-light">{g.count - g.items.length} autre(s) non affiché(s).</p>}
            </div>
        </section>
    );
}

export default function ReconciliationPage() {
    const [days, setDays] = useState(30);
    const { data, isLoading, error } = useQuery({ queryKey: ["reconciliation", days], queryFn: () => overviewApi.reconciliation(days), refetchInterval: 120_000 });
    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="page-title"><span className="gradient-text">Rapprochement</span></h1>
                    <p className="mt-1 max-w-2xl text-sm text-text-light">Chaque paiement confirmé doit avoir sa commande à jour et son accès livré ; chaque commande payée, sa preuve de paiement ; chaque notification, son traitement.</p>
                </div>
                <div className="flex rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="Fenêtre">
                    {WINDOWS.map((d) => <button key={d} type="button" role="tab" aria-selected={days === d} onClick={() => setDays(d)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", days === d ? "bg-primary text-white" : "text-text-light hover:text-text-main")}>{d} jours</button>)}
                </div>
            </div>
            {error && <p className="card p-4 text-sm text-danger">{(error as Error).message}</p>}
            {isLoading ? <div className="skeleton h-64 rounded-2xl" /> : data!.groups.length === 0 ? (
                <div className="card flex flex-col items-center gap-2 p-12 text-center">
                    <CheckCircle2 size={32} className="text-success" />
                    <p className="text-sm font-semibold text-text-main">Aucun écart sur {days} jours</p>
                    <p className="max-w-sm text-xs text-text-light">Paiements, commandes, accès et notifications concordent.</p>
                </div>
            ) : (
                <>
                    <p className="flex items-center gap-2 text-sm text-text-main"><Scale size={16} className="text-primary" />{data!.total} écart(s) sur {days} jours.</p>
                    <div className="grid gap-5 xl:grid-cols-2">{data!.groups.map((g) => <Group key={g.rule} g={g} />)}</div>
                </>
            )}
        </div>
    );
}
