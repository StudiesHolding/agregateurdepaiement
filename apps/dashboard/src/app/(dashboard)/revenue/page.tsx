"use client";

/**
 * Revenus (ADR-0019, D4)
 * ======================
 * D'où vient l'argent : brut, frais estimés des prestataires, net ; par pays, prestataire, moyen, produit et canal.
 * Les montants sont exacts PAR DEVISE ; l'équivalent dans une devise de référence utilise la grille de taux datée de
 * la plateforme (jamais une somme de devises différentes).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Coins, Info, Percent, Receipt, Ticket, TrendingUp, Wallet } from "lucide-react";
import { compact, countryName, money, percent } from "@/lib/format";
import { financeApi } from "@/lib/finance";
import { BarList, Panel, PeriodControls, Tile } from "@/components/finance/ui";

const FUNDER: Record<string, string> = { author: "Auteur", platform: "Studies Learning", shared: "Partagée", unknown: "Non renseigné" };

export default function RevenuePage() {
    const [range, setRange] = useState("30d");
    const [ref, setRef] = useState("XOF");
    const { data, isLoading, error } = useQuery({ queryKey: ["finance-revenue", range, ref], queryFn: () => financeApi.revenue({ range, ref }), refetchInterval: 120_000 });
    const cur = data?.referenceCurrency ?? ref;
    const fmt = (v: number) => money(v, cur);
    const trend = data && data.previous.gross ? (data.totals.reference.gross - data.previous.gross) / data.previous.gross : null;
    const share = (items: Array<{ key: string; label: string; gross: number; count: number; share: number }>, label?: (k: string, l: string) => string) =>
        items.map((i) => ({ key: i.key, label: label ? label(i.key, i.label) : i.label, value: i.gross, sub: `${i.count} paiement${i.count > 1 ? "s" : ""} · ${percent(i.share * 100, 0)}` }));

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="page-title">Provenance des <span className="gradient-text">revenus</span></h1>
                    <p className="mt-1 max-w-2xl text-sm text-text-light">Chaque paiement confirmé, d’où il vient et ce qu’il rapporte une fois les frais des prestataires déduits.</p>
                </div>
                <PeriodControls range={range} onRange={setRange} currency={ref} onCurrency={setRef} />
            </div>

            {error && <p className="card p-4 text-sm text-danger">{(error as Error).message}</p>}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Tile
                    label="Revenu brut" icon={<Wallet size={16} className="text-primary" />}
                    value={isLoading ? "–" : fmt(data!.totals.reference.gross)}
                    hint={trend == null ? "Pas de période précédente comparable" : <span className={trend >= 0 ? "text-success" : "text-danger"}>{trend >= 0 ? <ArrowUpRight size={12} className="inline" /> : <ArrowDownRight size={12} className="inline" />} {percent(Math.abs(trend) * 100, 0)} vs période précédente</span>}
                />
                <Tile label="Frais des prestataires (estimés)" icon={<Percent size={16} className="text-warning" />} value={isLoading ? "–" : fmt(data!.totals.reference.fees)} hint="Selon le barème renseigné sur chaque prestataire" />
                <Tile label="Revenu net" icon={<TrendingUp size={16} className="text-success" />} tone="text-success" value={isLoading ? "–" : fmt(data!.totals.reference.net)} hint="Brut moins frais estimés" />
                <Tile label="Paiements confirmés" icon={<Receipt size={16} className="text-secondary" />} value={isLoading ? "–" : data!.totals.count} hint={isLoading ? undefined : `Panier moyen ${fmt(data!.totals.reference.avg)}`} />
            </div>

            {data?.fx && (
                <p className="flex items-start gap-2 text-xs text-text-light">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    {data.fx.available
                        ? `Équivalents en ${cur} calculés avec la grille de taux de Studies Learning du ${new Date(data.fx.asOf!).toLocaleDateString("fr-FR")}. Les montants par devise ci-dessous sont exacts.`
                        : "Grille de taux indisponible : seuls les montants par devise sont fiables."}
                    {data.totals.reference.unconverted > 0 && ` ${data.totals.reference.unconverted} paiement(s) dans une devise absente de la grille ne sont pas convertis.`}
                </p>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Panel title="Revenu brut par jour" subtitle={`Équivalent en ${cur}`}>
                    {isLoading ? <div className="skeleton h-64 rounded-xl" /> : data!.series.length === 0 ? <p className="py-16 text-center text-sm text-text-light">Aucun paiement confirmé sur la période.</p> : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={data!.series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="date" tickFormatter={(d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
                                <YAxis tickFormatter={(v: number) => compact(v)} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                                <Tooltip cursor={{ fill: "rgba(79,70,229,0.06)" }} contentStyle={{ fontSize: 12, borderRadius: 12 }} labelFormatter={(d: string) => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} formatter={(v: number, _n, p) => [`${fmt(v)} · ${(p.payload as { count: number }).count} paiement(s)`, "Brut"]} />
                                <Bar dataKey="gross" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={28} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Panel>
                <Panel title="Par devise" subtitle="Montants exacts, sans conversion">
                    {isLoading ? <div className="skeleton h-40 rounded-xl" /> : data!.totals.byCurrency.length === 0 ? <p className="text-xs text-text-light">Aucun paiement.</p> : (
                        <table className="w-full text-xs">
                            <thead><tr className="text-left text-text-light"><th className="pb-2 font-semibold">Devise</th><th className="pb-2 text-right font-semibold">Brut</th><th className="pb-2 text-right font-semibold">Frais</th><th className="pb-2 text-right font-semibold">Net</th></tr></thead>
                            <tbody className="divide-y divide-border">
                                {data!.totals.byCurrency.map((c) => (
                                    <tr key={c.currency}>
                                        <td className="py-2 font-semibold text-text-main">{c.currency}<span className="block font-normal text-text-light">{c.count} paiement(s)</span></td>
                                        <td className="py-2 text-right tabular-nums text-text-main">{money(c.gross, c.currency)}</td>
                                        <td className="py-2 text-right tabular-nums text-warning-dark dark:text-warning">{money(c.fees, c.currency)}</td>
                                        <td className="py-2 text-right font-semibold tabular-nums text-success">{money(c.net, c.currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Panel>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <Panel title="Par pays du client">
                    {isLoading ? <div className="skeleton h-40 rounded-xl" /> : <BarList items={share(data!.breakdown.country, (k) => (k === "??" ? "Pays non renseigné" : `${countryName(k)} (${k})`))} format={fmt} />}
                </Panel>
                <Panel title="Par prestataire">
                    {isLoading ? <div className="skeleton h-40 rounded-xl" /> : <BarList items={share(data!.breakdown.provider)} format={fmt} />}
                </Panel>
                <Panel title="Par moyen de paiement">
                    {isLoading ? <div className="skeleton h-40 rounded-xl" /> : <BarList items={share(data!.breakdown.method)} format={fmt} />}
                </Panel>
                <Panel title="Par produit">
                    {isLoading ? <div className="skeleton h-40 rounded-xl" /> : <BarList items={share(data!.breakdown.product)} format={fmt} />}
                </Panel>
                <Panel title="Par canal d’acquisition">
                    {isLoading ? <div className="skeleton h-40 rounded-xl" /> : <BarList items={share(data!.breakdown.channel)} format={fmt} />}
                </Panel>
                <Panel title="Remises accordées" subtitle="Codes promo appliqués aux paiements confirmés">
                    {isLoading ? <div className="skeleton h-40 rounded-xl" /> : (
                        <div className="space-y-3">
                            <p className="flex items-center gap-2 text-2xl font-bold text-text-main"><Ticket size={18} className="text-primary" />{fmt(data!.discounts.total)}</p>
                            <p className="text-xs text-text-light">{data!.discounts.count} paiement(s) avec remise</p>
                            <BarList items={Object.entries(data!.discounts.byFunder).map(([k, v]) => ({ key: k, label: `Financée par : ${FUNDER[k] ?? k}`, value: v }))} format={fmt} empty="Aucune remise sur la période." />
                        </div>
                    )}
                </Panel>
            </div>

            <Panel title="Formations et offres qui rapportent le plus" subtitle={`Équivalent en ${cur}`}>
                {isLoading ? <div className="skeleton h-40 rounded-xl" /> : <BarList items={share(data!.topFormations)} format={fmt} empty="Aucune vente sur la période." />}
            </Panel>

            <p className="flex items-center gap-2 text-xs text-text-light"><Coins size={13} />Les paiements antérieurs à l’enregistrement du pays et du moyen (octobre 2026) apparaissent en « non renseigné ».</p>
        </div>
    );
}
