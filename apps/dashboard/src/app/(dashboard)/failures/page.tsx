"use client";

/**
 * Échecs et frictions (ADR-0019, D5)
 * ==================================
 * Où le canal de paiement perd des clients : entonnoir (achat lancé → paiement ouvert → confirmé), abandons, échecs
 * rangés par cause avec une EXPLICATION et une ACTION, taux de succès par prestataire, pays et moyen de paiement.
 */
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, ChevronDown, Clock, GitBranch, Lightbulb, RotateCcw, ShieldAlert, Target, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { countryName, money, percent } from "@/lib/format";
import { financeApi, type FailureCategory, type Rate } from "@/lib/finance";
import { Panel, PeriodControls, Tile } from "@/components/finance/ui";

const OWNER: Record<string, string> = { client: "Côté client", parcours: "Parcours d’achat", prestataire: "Prestataire", configuration: "Configuration", risque: "Risque", "à analyser": "À analyser" };
const duration = (s: number | null) => (s == null ? "—" : s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${(s / 3600).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`);

function Funnel({ f }: { f: { created: number; attempted: number; succeeded: number; failed: number; abandoned: number; pending: number } }) {
    const steps = [
        { label: "Achats lancés", value: f.created, hint: "Le client a choisi sa formation ou ses licences et lancé le paiement" },
        { label: "Paiement ouvert chez un prestataire", value: f.attempted, hint: `${f.created - f.attempted} n’ont jamais atteint le prestataire` },
        { label: "Paiements confirmés", value: f.succeeded, hint: `${f.failed} échec(s) · ${f.abandoned} abandon(s) · ${f.pending} en cours` },
    ];
    const max = Math.max(1, f.created);
    return (
        <ol className="space-y-3">
            {steps.map((s, i) => (
                <li key={s.label}>
                    <div className="mb-1 flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-text-main">{i + 1}. {s.label}</span>
                        <span className="tabular-nums text-text-light">{s.value}{i > 0 && steps[0].value ? ` · ${percent((s.value / steps[0].value) * 100, 0)}` : ""}</span>
                    </div>
                    <div className="h-7 rounded-lg bg-background">
                        <div className={cn("flex h-7 items-center rounded-lg px-2 text-[11px] font-semibold text-white", i === 2 ? "bg-success" : "bg-primary")} style={{ width: `${Math.max(4, (s.value / max) * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-text-light">{s.hint}</p>
                </li>
            ))}
        </ol>
    );
}

function CategoryCard({ c, currency }: { c: FailureCategory; currency: string }) {
    const [open, setOpen] = useState(false);
    const tone = c.tone === "danger" ? "border-danger/30 bg-danger-light/40" : c.tone === "warning" ? "border-warning/30 bg-warning-light/40" : "border-border";
    return (
        <article className={cn("rounded-2xl border p-4", tone)}>
            <header className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h3 className="text-sm font-bold text-text-main">{c.label}</h3>
                    <p className="text-xs text-text-light">{OWNER[c.owner] ?? c.owner} · {c.count} cas · {percent(c.share * 100, 0)} des pertes</p>
                </div>
                <span className="badge badge-neutral" title="Montant des paiements perdus, équivalent">{money(c.amountAtRisk, currency)}</span>
            </header>
            <p className="mt-2 text-xs text-text-main">{c.explanation}</p>
            <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-surface px-3 py-2 text-xs text-text-main"><Lightbulb size={13} className="mt-0.5 shrink-0 text-primary" />{c.action}</p>
            <p className="mt-2 text-[11px] text-text-light">{Object.entries(c.providers).map(([p, n]) => `${p} : ${n}`).join(" · ")}</p>
            {c.examples.length > 0 && (
                <>
                    <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary">
                        <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />Exemples récents
                    </button>
                    {open && (
                        <ul className="mt-2 space-y-1.5">
                            {c.examples.map((e, i) => (
                                <li key={`${e.reference}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-[11px]">
                                    <span className="text-text-main">
                                        {e.reference ? <Link href={`/transactions?search=${encodeURIComponent(e.reference)}`} className="font-mono font-semibold text-primary">{e.reference}</Link> : "Sans référence"}
                                        <span className="ml-2 text-text-light">{new Date(e.at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {e.country === "??" ? "pays inconnu" : countryName(e.country)}{e.provider ? ` · ${e.provider}` : ""}</span>
                                    </span>
                                    <span className="tabular-nums text-text-main">{money(e.amount, e.currency)}{e.errorCode ? <span className="ml-2 font-mono text-text-light">{e.errorCode}</span> : null}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </article>
    );
}

function RateTable({ rows, label, render }: { rows: Rate[]; label: string; render?: (r: Rate) => string }) {
    if (!rows.length) return <p className="text-xs text-text-light">Aucune donnée.</p>;
    return (
        <table className="w-full text-xs">
            <thead><tr className="text-left text-text-light"><th className="pb-2 font-semibold">{label}</th><th className="pb-2 text-right font-semibold">Succès</th><th className="pb-2 text-right font-semibold">Échecs</th><th className="pb-2 text-right font-semibold">Abandons</th></tr></thead>
            <tbody className="divide-y divide-border">
                {rows.map((r) => (
                    <tr key={r.key}>
                        <td className="py-2 font-medium text-text-main">{render ? render(r) : r.label}<span className="block text-[11px] font-normal text-text-light">{r.total} achat(s)</span></td>
                        <td className={cn("py-2 text-right font-semibold tabular-nums", r.successRate == null ? "text-text-light" : r.successRate >= 0.8 ? "text-success" : r.successRate >= 0.5 ? "text-warning-dark dark:text-warning" : "text-danger")}>{r.successRate == null ? "—" : percent(r.successRate * 100, 0)}</td>
                        <td className="py-2 text-right tabular-nums text-text-main">{r.failed}</td>
                        <td className="py-2 text-right tabular-nums text-text-main">{r.abandoned}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default function FailuresPage() {
    const [range, setRange] = useState("30d");
    const { data, isLoading, error } = useQuery({ queryKey: ["finance-failures", range], queryFn: () => financeApi.failures({ range, ref: "XOF" }), refetchInterval: 120_000 });
    const cur = data?.referenceCurrency ?? "XOF";

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="page-title">Échecs et <span className="gradient-text">frictions</span></h1>
                    <p className="mt-1 max-w-2xl text-sm text-text-light">Où et pourquoi le canal de paiement perd des clients, et quoi faire pour en récupérer.</p>
                </div>
                <PeriodControls range={range} onRange={setRange} />
            </div>
            {error && <p className="card p-4 text-sm text-danger">{(error as Error).message}</p>}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <Tile label="Taux de succès" icon={<Target size={16} className="text-success" />} tone="text-success" value={isLoading ? "–" : data!.rates.success == null ? "—" : percent(data!.rates.success * 100, 0)} hint="Paiements confirmés / achats tranchés" />
                <Tile label="Abandons" icon={<UserX size={16} className="text-warning" />} value={isLoading ? "–" : data!.rates.abandonment == null ? "—" : percent(data!.rates.abandonment * 100, 0)} hint={`Sans paiement après ${data?.abandonAfterMinutes ?? 30} min`} />
                <Tile label="Échecs" icon={<ShieldAlert size={16} className="text-danger" />} value={isLoading ? "–" : data!.rates.failure == null ? "—" : percent(data!.rates.failure * 100, 0)} hint="Refus, erreurs, annulations" />
                <Tile label="Délai médian de paiement" icon={<Clock size={16} className="text-secondary" />} value={isLoading ? "–" : duration(data!.medianTimeToPaySeconds)} hint="Du lancement du paiement à sa confirmation" />
                <Tile label="Sauvés par bascule" icon={<RotateCcw size={16} className="text-primary" />} value={isLoading ? "–" : data!.failover.recoveredByFailover} hint={isLoading ? undefined : `${data!.failover.intentsWithSeveralAttempts} achat(s) avec plusieurs tentatives`} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <Panel title="Entonnoir du canal de paiement" subtitle="Achats lancés sur la période">
                    {isLoading ? <div className="skeleton h-56 rounded-xl" /> : <Funnel f={data!.funnel} />}
                </Panel>
                <Panel title="Pourquoi les paiements échouent" subtitle={`Classés par cause, avec la marche à suivre · montants en équivalent ${cur}`}>
                    {isLoading ? <div className="skeleton h-56 rounded-xl" /> : data!.categories.length === 0 ? (
                        <p className="flex items-center gap-2 py-10 text-sm text-text-light"><Target size={16} className="text-success" />Aucun échec ni abandon sur la période.</p>
                    ) : (
                        <div className="grid gap-3 lg:grid-cols-2">{data!.categories.map((c) => <CategoryCard key={c.category} c={c} currency={cur} />)}</div>
                    )}
                </Panel>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <Panel title="Par prestataire" aside={<Link href="/providers" className="flex items-center gap-1 text-xs font-semibold text-primary">Santé <ArrowRight size={12} /></Link>}>
                    {isLoading ? <div className="skeleton h-32 rounded-xl" /> : <RateTable rows={data!.byProvider} label="Prestataire" />}
                </Panel>
                <Panel title="Par pays du client">
                    {isLoading ? <div className="skeleton h-32 rounded-xl" /> : <RateTable rows={data!.byCountry} label="Pays" render={(r) => (r.key === "??" ? "Non renseigné" : `${countryName(r.key)} (${r.key})`)} />}
                </Panel>
                <Panel title="Par moyen de paiement" aside={<Link href="/routing" className="flex items-center gap-1 text-xs font-semibold text-primary"><GitBranch size={12} />Règles</Link>}>
                    {isLoading ? <div className="skeleton h-32 rounded-xl" /> : <RateTable rows={data!.byMethod} label="Moyen" />}
                </Panel>
            </div>

            <p className="flex items-center gap-2 text-xs text-text-light"><AlertTriangle size={13} />Un achat « avant choix du prestataire » n’a jamais atteint de prestataire : souvent un abandon sur la page de paiement, ou une voie sans règle.</p>
        </div>
    );
}
