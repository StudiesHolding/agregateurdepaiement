"use client";

/**
 * Centre de pilotage (ADR-0019, D6)
 * =================================
 * L'essentiel de la caisse en un écran : ce qu'il faut traiter maintenant (chaque point mène à son action), revenus
 * du jour et de la semaine, succès des paiements sur 24 h, santé des prestataires, risques de routage, écarts.
 */
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Activity, AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, GitBranch, RefreshCw, Scale, Target, TrendingUp, Wallet, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { money, percent } from "@/lib/format";
import { overviewApi } from "@/lib/finance";
import { Blason } from "@/components/brand/BrandMark";
import { Panel, Tile } from "@/components/finance/ui";
import { useAccess } from "@/lib/access";

const STATUS: Record<string, { label: string; badge: string }> = {
    operational: { label: "Opérationnel", badge: "badge-success" }, degraded: { label: "Dégradé", badge: "badge-warning" },
    critical: { label: "Critique", badge: "badge-danger" }, idle: { label: "Sans trafic", badge: "badge-primary" },
    inactive: { label: "Désactivé", badge: "badge-neutral" }, maintenance: { label: "Maintenance", badge: "badge-warning" },
    not_configured: { label: "Identifiants manquants", badge: "badge-danger" },
};

export default function CommandCenter() {
    const { user } = useAccess();
    const [ref, setRef] = useState("XOF");
    const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ["finance-overview", ref], queryFn: () => overviewApi.get(ref), refetchInterval: 60_000 });
    const cur = data?.referenceCurrency ?? ref;
    const fmt = (v: number) => money(v, cur);
    const weekTrend = data && data.revenue.week.previousGross ? (data.revenue.week.gross - data.revenue.week.previousGross) / data.revenue.week.previousGross : null;
    const firstName = (user?.name ?? "").split(" ")[0];
    const urgent = data?.todo.filter((t) => t.severity === "danger").length ?? 0;

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Blason size={56} className="hidden sm:inline-flex" />
                    <div>
                        <h1 className="page-title">Centre de <span className="gradient-text">pilotage</span></h1>
                        <p className="mt-1 text-sm text-text-light">
                            {firstName ? `Bonjour ${firstName}. ` : ""}
                            {isLoading ? "Lecture de la caisse…" : urgent ? `${urgent} point(s) urgent(s) à traiter.` : data?.todo.length ? "Rien d’urgent ; quelques points à améliorer." : "Tout est en ordre."}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select className="input w-auto py-1.5 text-xs" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Devise de référence">
                        {["XOF", "XAF", "EUR", "USD"].map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <button type="button" onClick={() => refetch()} className="btn-secondary text-xs"><RefreshCw size={14} className={cn(isFetching && "animate-spin")} />Actualiser</button>
                </div>
            </div>
            {error && <p className="card p-4 text-sm text-danger">{(error as Error).message}</p>}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Tile label="Encaissé aujourd’hui" icon={<Wallet size={16} className="text-primary" />} value={isLoading ? "–" : fmt(data!.revenue.today.gross)} hint={isLoading ? undefined : `${data!.revenue.today.count} paiement(s) · net ${fmt(data!.revenue.today.net)}`} />
                <Tile
                    label="7 derniers jours" icon={<TrendingUp size={16} className="text-success" />} value={isLoading ? "–" : fmt(data!.revenue.week.gross)}
                    hint={weekTrend == null ? (isLoading ? undefined : `${data!.revenue.week.count} paiement(s)`) : <span className={weekTrend >= 0 ? "text-success" : "text-danger"}>{weekTrend >= 0 ? "+" : "−"}{percent(Math.abs(weekTrend) * 100, 0)} vs 7 jours précédents</span>}
                />
                <Tile label="Succès des paiements (24 h)" icon={<Target size={16} className="text-secondary" />} value={isLoading ? "–" : data!.last24h.successRate == null ? "—" : percent(data!.last24h.successRate * 100, 0)} hint={isLoading ? undefined : data!.last24h.topCause ? `Première cause d’échec : ${data!.last24h.topCause.label}` : `${data!.last24h.funnel.created} achat(s) sur 24 h`} />
                <Tile label="Écarts de rapprochement" icon={<Scale size={16} className={data?.reconciliation.total ? "text-danger" : "text-success"} />} tone={data?.reconciliation.total ? "text-danger" : "text-text-main"} value={isLoading ? "–" : data!.reconciliation.total} hint={<Link href="/reconciliation" className="font-semibold text-primary">Voir le rapprochement</Link>} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <Panel title="À traiter maintenant" subtitle="Classé par urgence ; chaque point mène à son action">
                    {isLoading ? <div className="skeleton h-48 rounded-xl" /> : data!.todo.length === 0 ? (
                        <p className="flex items-center gap-2 py-8 text-sm text-text-light"><CheckCircle2 size={18} className="text-success" />Rien à traiter : paiements, prestataires et rapprochement sont en ordre.</p>
                    ) : (
                        <ul className="space-y-2">
                            {data!.todo.map((t, i) => (
                                <li key={`${t.title}-${i}`}>
                                    <Link href={t.href} className={cn("group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition hover:shadow-card", t.severity === "danger" ? "border-danger/25 bg-danger-light/40" : "border-warning/25 bg-warning-light/40")}>
                                        {t.severity === "danger" ? <AlertOctagon size={16} className="mt-0.5 shrink-0 text-danger" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />}
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-semibold text-text-main">{t.title}</span>
                                            <span className="block text-xs text-text-light">{t.detail}</span>
                                        </span>
                                        <ArrowRight size={14} className="mt-1 shrink-0 text-text-light transition group-hover:translate-x-0.5 group-hover:text-primary" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <div className="space-y-6">
                    <Panel title="Prestataires" subtitle="Dernières 24 heures" aside={<Link href="/providers" className="flex items-center gap-1 text-xs font-semibold text-primary">Détails <ArrowRight size={12} /></Link>}>
                        {isLoading ? <div className="skeleton h-28 rounded-xl" /> : (
                            <ul className="divide-y divide-border">
                                {data!.providers.map((p) => {
                                    const s = STATUS[p.status] ?? STATUS.idle;
                                    return (
                                        <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                                            <span className="flex items-center gap-2 text-sm font-semibold text-text-main">
                                                {p.status === "maintenance" ? <Wrench size={14} className="text-warning" /> : <Activity size={14} className="text-text-light" />}{p.name}
                                                {p.mode === "test" && <span className="badge badge-warning">test</span>}
                                            </span>
                                            <span className="flex items-center gap-2 text-xs text-text-light">
                                                {p.successRate != null && <span className="tabular-nums">{percent(p.successRate, 0)} · {p.attempts}</span>}
                                                <span className={cn("badge", s.badge)}>{s.label}</span>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Panel>
                    <Panel title="Routage" aside={<Link href="/routing" className="flex items-center gap-1 text-xs font-semibold text-primary"><GitBranch size={12} />Règles</Link>}>
                        {isLoading ? <div className="skeleton h-16 rounded-xl" /> : (
                            <dl className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-xl bg-background p-2"><dt className="text-[11px] text-text-light">Voies</dt><dd className="text-lg font-bold text-text-main">{data!.lanes.total}</dd></div>
                                <div className="rounded-xl bg-background p-2"><dt className="text-[11px] text-text-light">Sans bascule</dt><dd className={cn("text-lg font-bold", data!.lanes.noFallback ? "text-warning" : "text-text-main")}>{data!.lanes.noFallback}</dd></div>
                                <div className="rounded-xl bg-background p-2"><dt className="text-[11px] text-text-light">Bloquées</dt><dd className={cn("text-lg font-bold", data!.lanes.broken ? "text-danger" : "text-text-main")}>{data!.lanes.broken}</dd></div>
                            </dl>
                        )}
                    </Panel>
                </div>
            </div>

            <Panel title="Encaissements des 7 derniers jours" subtitle={`Équivalent en ${cur}`} aside={<Link href="/revenue" className="flex items-center gap-1 text-xs font-semibold text-primary">Provenance <ArrowRight size={12} /></Link>}>
                {isLoading ? <div className="skeleton h-40 rounded-xl" /> : data!.revenue.series.length === 0 ? <p className="py-10 text-center text-sm text-text-light">Aucun encaissement sur 7 jours.</p> : (
                    <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={data!.revenue.series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                            <defs>
                                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} /><stop offset="100%" stopColor="#4f46e5" stopOpacity={0} /></linearGradient>
                            </defs>
                            <XAxis dataKey="date" tickFormatter={(d: string) => new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} labelFormatter={(d: string) => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} formatter={(v: number) => [fmt(v), "Encaissé"]} />
                            <Area type="monotone" dataKey="gross" stroke="#4f46e5" strokeWidth={2} fill="url(#rev)" />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </Panel>
        </div>
    );
}
