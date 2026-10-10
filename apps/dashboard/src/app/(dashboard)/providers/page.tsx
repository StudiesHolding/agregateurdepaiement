"use client";

/**
 * Prestataires (ADR-0019, D3)
 * ===========================
 * Une fiche par prestataire : santé sur la période, préparation technique (identifiants présents dans l'environnement,
 * jamais leur valeur), mode test ou production, état (actif, maintenance), barème de frais et délai de reversement
 * (qui alimentent le calcul du net), couverture (pays, devises) et erreurs fréquentes.
 */
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
    Activity, AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, CreditCard, Plus, Power, Settings2, ShieldCheck,
    Smartphone, Stethoscope, Wrench, X, XCircle, Clock, Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccess } from "@/lib/access";
import { countryName, percent, type PaymentMethod } from "@/lib/format";
import { HEALTH, providersApi, type ProviderSheet, type SettingsInput } from "@/lib/providers";

const PERIODS = [{ id: "24h", label: "24 h" }, { id: "7d", label: "7 jours" }, { id: "30d", label: "30 jours" }];

function SuccessRing({ rate }: { rate: number | null }) {
    const r = 32;
    const c = 2 * Math.PI * r;
    const v = rate ?? 0;
    const color = rate == null ? "#94a3b8" : v >= 80 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444";
    return (
        <div className="relative grid h-20 w-20 shrink-0 place-items-center">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden>
                <circle cx="40" cy="40" r={r} className="stroke-border" strokeWidth="6" fill="none" />
                <circle cx="40" cy="40" r={r} stroke={color} strokeWidth="6" fill="none" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} strokeLinecap="round" transform="rotate(-90 40 40)" style={{ transition: "stroke-dashoffset 1s ease" }} />
            </svg>
            <span className="absolute text-center">
                <span className="block text-sm font-bold text-text-main">{rate == null ? "—" : `${Math.round(v)} %`}</span>
                <span className="block text-[10px] text-text-light">succès</span>
            </span>
        </div>
    );
}

const feeLabel = (p: ProviderSheet, m: PaymentMethod) => {
    const f = p.fees[m];
    if (!f) return "non renseigné";
    return [f.percent ? `${f.percent.toLocaleString("fr-FR")} %` : null, f.fixed ? `${f.fixed.toLocaleString("fr-FR")} ${f.currency ?? ""}` : null].filter(Boolean).join(" + ") || "aucun frais";
};

// ── Détails (courbe 48 h, erreurs) ────────────────────────────────────────────

function Details({ id, period }: { id: number; period: string }) {
    const spark = useQuery({ queryKey: ["provider-spark", id], queryFn: () => providersApi.sparkline(id) });
    const errors = useQuery({ queryKey: ["provider-errors", id, period], queryFn: () => providersApi.errors(id, period) });
    return (
        <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
            <div>
                <p className="mb-2 text-xs font-semibold text-text-light">Taux de succès par heure (48 h)</p>
                {spark.isLoading ? <div className="skeleton h-20 rounded-xl" /> : (spark.data?.length ?? 0) === 0 ? <p className="text-xs text-text-light">Aucune tentative sur 48 h.</p> : (
                    <ResponsiveContainer width="100%" height={80}>
                        <LineChart data={spark.data}>
                            <XAxis dataKey="hour" hide />
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [`${v} %`, "Succès"]} labelFormatter={(l: string) => l.slice(-5)} />
                            <Line type="monotone" dataKey="successRate" stroke="#4f46e5" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
            <div>
                <p className="mb-2 text-xs font-semibold text-text-light">Erreurs les plus fréquentes</p>
                {errors.isLoading ? <div className="skeleton h-20 rounded-xl" /> : (errors.data?.length ?? 0) === 0 ? <p className="text-xs text-text-light">Aucune erreur sur la période.</p> : (
                    <ul className="space-y-1.5">
                        {errors.data!.map((e) => (
                            <li key={`${e.errorCode}-${e.errorMessage}`} className="flex items-start justify-between gap-2 text-xs">
                                <span className="min-w-0"><span className="font-mono font-semibold text-text-main">{e.errorCode}</span> <span className="text-text-light">{e.errorMessage}</span></span>
                                <span className="badge badge-danger shrink-0">{e.occurrences}</span>
                            </li>
                        ))}
                    </ul>
                )}
                <Link href="/failures" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">Analyse des échecs <ArrowRight size={12} /></Link>
            </div>
        </div>
    );
}

// ── Réglages ──────────────────────────────────────────────────────────────────

function SettingsDialog({ provider, onClose }: { provider: ProviderSheet; onClose: () => void }) {
    const qc = useQueryClient();
    const [form, setForm] = useState<Required<Pick<SettingsInput, "name" | "settlementDays">> & { fees: Record<PaymentMethod, { percent: number; fixed: number; currency: string }>; note: string; maintenance: { active: boolean; reason: string; until: string } }>({
        name: provider.name,
        settlementDays: provider.settlementDays ?? 0,
        note: provider.note ?? "",
        fees: {
            card: { percent: provider.fees.card?.percent ?? 0, fixed: provider.fees.card?.fixed ?? 0, currency: provider.fees.card?.currency ?? "EUR" },
            mobile_money: { percent: provider.fees.mobile_money?.percent ?? 0, fixed: provider.fees.mobile_money?.fixed ?? 0, currency: provider.fees.mobile_money?.currency ?? "XOF" },
        },
        maintenance: { active: provider.maintenance.active, reason: provider.maintenance.reason ?? "", until: provider.maintenance.until ? provider.maintenance.until.slice(0, 16) : "" },
    });
    const methods: PaymentMethod[] = [...(provider.supportMobileMoney ? ["mobile_money" as const] : []), ...(provider.supportCard ? ["card" as const] : [])];
    const save = useMutation({
        mutationFn: () => providersApi.update(provider.id, {
            name: form.name, settlementDays: form.settlementDays, note: form.note,
            fees: Object.fromEntries(methods.map((m) => [m, form.fees[m]])),
            maintenance: { active: form.maintenance.active, reason: form.maintenance.reason, until: form.maintenance.until ? new Date(form.maintenance.until).toISOString() : null },
        }),
        onSuccess: () => { toast.success("Réglages enregistrés"); qc.invalidateQueries({ queryKey: ["providers"] }); qc.invalidateQueries({ queryKey: ["routing-matrix"] }); onClose(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const setFee = (m: PaymentMethod, k: "percent" | "fixed" | "currency", v: string) =>
        setForm((f) => ({ ...f, fees: { ...f.fees, [m]: { ...f.fees[m], [k]: k === "currency" ? v.toUpperCase() : Number(v) } } }));

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Réglages de ${provider.name}`} onClick={onClose}>
            <form className="card max-h-[90vh] w-full max-w-xl overflow-y-auto p-6 animate-slide-up" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
                <div className="mb-5 flex items-start justify-between">
                    <div>
                        <h2 className="section-title">Réglages de {provider.name}</h2>
                        <p className="mt-1 text-xs text-text-light">Les identifiants restent dans l’environnement du serveur ; ici, l’exploitation et la finance.</p>
                    </div>
                    <button type="button" onClick={onClose} className="btn-ghost rounded-lg p-1.5" aria-label="Fermer"><X size={16} /></button>
                </div>

                <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-light">État</h3>
                    <label className="flex items-center gap-2 text-sm font-semibold text-text-main">
                        <input type="checkbox" className="h-4 w-4 accent-[#f59e0b]" checked={form.maintenance.active} onChange={(e) => setForm({ ...form, maintenance: { ...form.maintenance, active: e.target.checked } })} />
                        En maintenance (écarté du routage, les bascules prennent le relais)
                    </label>
                    {form.maintenance.active && (
                        <div className="grid grid-cols-2 gap-3">
                            <label className="col-span-2 text-xs font-semibold text-text-light">Motif (visible par l’équipe)
                                <input className="input mt-1" value={form.maintenance.reason} onChange={(e) => setForm({ ...form, maintenance: { ...form.maintenance, reason: e.target.value } })} placeholder="ex. incident chez l’opérateur Orange" />
                            </label>
                            <label className="text-xs font-semibold text-text-light">Fin prévue (facultatif)
                                <input type="datetime-local" className="input mt-1" value={form.maintenance.until} onChange={(e) => setForm({ ...form, maintenance: { ...form.maintenance, until: e.target.value } })} />
                            </label>
                        </div>
                    )}
                </section>

                <section className="mt-6 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-light">Barème de frais du prestataire</h3>
                    <p className="text-xs text-text-light">Sert à estimer le coût de chaque paiement et le revenu net dans l’analyse des revenus.</p>
                    {methods.map((m) => (
                        <div key={m} className="grid grid-cols-[1fr_90px_100px_80px] items-end gap-2">
                            <span className="flex items-center gap-1.5 pb-2 text-sm font-semibold text-text-main">{m === "card" ? <CreditCard size={14} /> : <Smartphone size={14} />}{m === "card" ? "Carte" : "Mobile Money"}</span>
                            <label className="text-[11px] font-semibold text-text-light">%<input type="number" step="0.01" min={0} max={25} className="input mt-1" value={form.fees[m].percent} onChange={(e) => setFee(m, "percent", e.target.value)} /></label>
                            <label className="text-[11px] font-semibold text-text-light">Fixe<input type="number" step="0.01" min={0} className="input mt-1" value={form.fees[m].fixed} onChange={(e) => setFee(m, "fixed", e.target.value)} /></label>
                            <label className="text-[11px] font-semibold text-text-light">Devise<input className="input mt-1 uppercase" maxLength={3} value={form.fees[m].currency} onChange={(e) => setFee(m, "currency", e.target.value)} /></label>
                        </div>
                    ))}
                    <label className="block text-xs font-semibold text-text-light">Délai de reversement (jours)
                        <input type="number" min={0} max={90} className="input mt-1 block w-32" value={form.settlementDays} onChange={(e) => setForm({ ...form, settlementDays: Number(e.target.value) })} />
                    </label>
                </section>

                <section className="mt-6 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-light">Présentation</h3>
                    <label className="block text-xs font-semibold text-text-light">Nom affiché
                        <input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label className="block text-xs font-semibold text-text-light">Note interne
                        <textarea className="input mt-1" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Contact du chargé de compte, contrat, plafonds négociés…" />
                    </label>
                </section>

                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
                    <button type="submit" disabled={save.isPending} className="btn-primary">{save.isPending ? "Enregistrement…" : "Enregistrer"}</button>
                </div>
            </form>
        </div>
    );
}

// ── Carte prestataire ─────────────────────────────────────────────────────────

function ProviderCard({ p, period, canManage, onSettings }: { p: ProviderSheet; period: string; canManage: boolean; onSettings: () => void }) {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [checks, setChecks] = useState<Array<{ label: string; ok: boolean; detail?: string }> | null>(null);
    const h = HEALTH[p.stats.healthStatus] ?? HEALTH.idle;
    const refresh = () => { qc.invalidateQueries({ queryKey: ["providers"] }); qc.invalidateQueries({ queryKey: ["routing-matrix"] }); };
    const toggle = useMutation({ mutationFn: () => providersApi.toggle(p.id), onSuccess: (r) => { toast.success(r.message); refresh(); }, onError: (e: Error) => toast.error(e.message) });
    const test = useMutation({ mutationFn: () => providersApi.test(p.id), onSuccess: (r) => { setChecks(r.data.checks); (r.data.ok ? toast.success : toast.error)(r.message); }, onError: (e: Error) => toast.error(e.message) });

    return (
        <article className="card p-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary text-sm font-bold text-white shadow-glow">{p.name.slice(0, 2).toUpperCase()}</span>
                    <div>
                        <h3 className="text-base font-bold text-text-main">{p.name}</h3>
                        <p className="flex items-center gap-1.5 text-xs text-text-light">
                            <span className="font-mono">{p.code}</span>
                            {p.readiness.mode && <span className={cn("badge", p.readiness.mode === "live" ? "badge-success" : "badge-warning")}>{p.readiness.mode === "live" ? "Production" : "Mode test"}</span>}
                        </p>
                    </div>
                </div>
                <span className={cn("badge", h.badge)}>{p.stats.healthStatus === "operational" ? <CheckCircle2 size={12} /> : p.stats.healthStatus === "maintenance" ? <Wrench size={12} /> : <Activity size={12} />}{h.label}</span>
            </header>

            {p.inMaintenance && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-light px-3 py-2 text-xs text-warning-dark">
                    <Wrench size={14} className="mt-0.5 shrink-0" />
                    <span>En maintenance : {p.maintenance.reason}{p.maintenance.until ? ` · fin prévue le ${new Date(p.maintenance.until).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}. Écarté du routage.</span>
                </p>
            )}

            <div className="mt-4 flex items-center gap-4">
                <SuccessRing rate={p.stats.successRate} />
                <dl className="grid flex-1 grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-background p-2"><dt className="text-[11px] text-text-light">Tentatives</dt><dd className="text-base font-bold text-text-main">{p.stats.totalAttempts}</dd></div>
                    <div className="rounded-xl bg-background p-2"><dt className="text-[11px] text-text-light">Réussies</dt><dd className="text-base font-bold text-success">{p.stats.successCount}</dd></div>
                    <div className="rounded-xl bg-background p-2"><dt className="text-[11px] text-text-light">Échouées</dt><dd className="text-base font-bold text-danger">{p.stats.failureCount}</dd></div>
                </dl>
            </div>

            <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-xl border border-border p-3">
                    <p className="mb-1.5 font-semibold text-text-light">Couverture</p>
                    <p className="flex flex-wrap gap-1">
                        {p.supportMobileMoney && <span className="badge badge-primary"><Smartphone size={11} /> Mobile Money</span>}
                        {p.supportCard && <span className="badge badge-primary"><CreditCard size={11} /> Carte</span>}
                    </p>
                    <p className="mt-2 text-text-main">{p.coverage.activeRules} règle(s) active(s) · {p.coverage.currencies.join(", ") || "aucune devise"}</p>
                    <p className="mt-0.5 text-text-light" title={p.coverage.countries.map(countryName).join(", ")}>{p.coverage.countries.length ? p.coverage.countries.map((c) => (c === "*" ? "tous pays" : c)).join(" · ") : "Aucun pays : ce prestataire n’encaisse rien"}</p>
                    <Link href="/routing" className="mt-2 inline-flex items-center gap-1 font-semibold text-primary">Règles de priorité <ArrowRight size={12} /></Link>
                </div>
                <div className="rounded-xl border border-border p-3">
                    <p className="mb-1.5 font-semibold text-text-light">Finance</p>
                    {p.supportMobileMoney && <p className="text-text-main">Mobile Money : {feeLabel(p, "mobile_money")}</p>}
                    {p.supportCard && <p className="text-text-main">Carte : {feeLabel(p, "card")}</p>}
                    <p className="mt-1 flex items-center gap-1 text-text-light"><Clock size={12} />Reversement {p.settlementDays == null ? "non renseigné" : p.settlementDays === 0 ? "le jour même" : `sous ${p.settlementDays} jour(s)`}</p>
                    {p.note && <p className="mt-1 text-text-light italic">{p.note}</p>}
                </div>
            </div>

            <div className="mt-3 rounded-xl border border-border p-3 text-xs">
                <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-text-light"><ShieldCheck size={13} />Préparation technique</p>
                <ul className="grid gap-1 sm:grid-cols-2">
                    {p.readiness.credentials.map((c) => (
                        <li key={c.env} className="flex items-center gap-1.5">{c.present ? <CheckCircle2 size={13} className="text-success" /> : <XCircle size={13} className="text-danger" />}<span className="text-text-main">{c.label}</span><span className="font-mono text-[10px] text-text-light">{c.env}</span></li>
                    ))}
                    {p.readiness.optional.map((c) => (
                        <li key={c.env} className="flex items-center gap-1.5">{c.present ? <CheckCircle2 size={13} className="text-success" /> : <AlertTriangle size={13} className="text-warning" />}<span className="text-text-main">{c.label}</span><span className="text-[10px] text-text-light">recommandé</span></li>
                    ))}
                </ul>
                {p.readiness.webhookPath && <p className="mt-2 flex items-center gap-1.5 text-text-light"><Webhook size={12} />Notifications : <span className="font-mono text-text-main">{p.readiness.webhookPath}</span></p>}
                {p.readiness.verification && <p className="mt-1 text-text-light">{p.readiness.verification}</p>}
                {checks && (
                    <ul className="mt-2 space-y-0.5 border-t border-border pt-2">
                        {checks.map((c) => <li key={c.label} className="flex items-center gap-1.5">{c.ok ? <CheckCircle2 size={12} className="text-success" /> : <XCircle size={12} className="text-danger" />}{c.label}{c.detail ? ` : ${c.detail}` : ""}</li>)}
                    </ul>
                )}
            </div>

            <footer className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setOpen((v) => !v)} className="btn-secondary text-xs"><ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />Courbe et erreurs</button>
                {canManage && (
                    <>
                        <button type="button" onClick={() => test.mutate()} disabled={test.isPending} className="btn-secondary text-xs"><Stethoscope size={14} />{test.isPending ? "Contrôle…" : "Tester la préparation"}</button>
                        <button type="button" onClick={onSettings} className="btn-secondary text-xs"><Settings2 size={14} />Réglages</button>
                        <button
                            type="button"
                            onClick={() => { if (!p.isActive || window.confirm(`Désactiver ${p.name} ? Les voies dont il est le seul prestataire ne pourront plus encaisser.`)) toggle.mutate(); }}
                            disabled={toggle.isPending}
                            className={cn("ml-auto text-xs", p.isActive ? "btn-danger" : "btn-primary")}
                        >
                            <Power size={14} />{p.isActive ? "Désactiver" : "Activer"}
                        </button>
                    </>
                )}
            </footer>
            {open && <Details id={p.id} period={period} />}
        </article>
    );
}

// ── Ajout depuis le catalogue ─────────────────────────────────────────────────

function AddProvider({ onClose }: { onClose: () => void }) {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ["providers-catalog"], queryFn: providersApi.catalog });
    const add = useMutation({
        mutationFn: (code: string) => providersApi.create(code),
        onSuccess: (p) => { toast.success(`${p.name} inscrit, désactivé : configurez ses règles puis activez-le.`); qc.invalidateQueries({ queryKey: ["providers"] }); qc.invalidateQueries({ queryKey: ["providers-catalog"] }); onClose(); },
        onError: (e: Error) => toast.error(e.message),
    });
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Ajouter un prestataire" onClick={onClose}>
            <div className="card w-full max-w-lg p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-start justify-between">
                    <div>
                        <h2 className="section-title">Ajouter un prestataire</h2>
                        <p className="mt-1 text-xs text-text-light">Seuls les prestataires réellement intégrés à l’agrégateur sont proposés. Leurs identifiants se placent dans l’environnement du serveur.</p>
                    </div>
                    <button type="button" onClick={onClose} className="btn-ghost rounded-lg p-1.5" aria-label="Fermer"><X size={16} /></button>
                </div>
                {isLoading ? <div className="skeleton h-32 rounded-xl" /> : (
                    <ul className="space-y-2">
                        {data?.map((c) => (
                            <li key={c.code} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                                <div>
                                    <p className="text-sm font-semibold text-text-main">{c.name}</p>
                                    <p className="text-xs text-text-light">{c.methods.map((m) => (m === "card" ? "Carte" : "Mobile Money")).join(" · ")} · {c.readiness.ready ? "identifiants présents" : "identifiants à configurer"}</p>
                                </div>
                                {c.registered ? <span className="badge badge-neutral">Déjà inscrit</span> : (
                                    <button type="button" onClick={() => add.mutate(c.code)} disabled={add.isPending} className="btn-primary text-xs"><Plus size={14} />Inscrire</button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProvidersPage() {
    const { can } = useAccess();
    const canManage = can("psp.providers.manage");
    const [period, setPeriod] = useState("24h");
    const [settings, setSettings] = useState<ProviderSheet | null>(null);
    const [adding, setAdding] = useState(false);
    const { data = [], isLoading, error } = useQuery({ queryKey: ["providers", period], queryFn: () => providersApi.list(period), refetchInterval: 60_000 });

    const count = (s: string[]) => data.filter((p) => s.includes(p.stats.healthStatus)).length;
    const totals = data.reduce((acc, p) => ({ attempts: acc.attempts + p.stats.totalAttempts, success: acc.success + p.stats.successCount }), { attempts: 0, success: 0 });

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="page-title">Santé des <span className="gradient-text">prestataires</span></h1>
                    <p className="mt-1 max-w-2xl text-sm text-text-light">Qui encaisse, avec quel taux de succès, à quel coût, et ce qu’il manque pour être prêt.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="Période">
                        {PERIODS.map((x) => <button key={x.id} type="button" role="tab" aria-selected={period === x.id} onClick={() => setPeriod(x.id)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold", period === x.id ? "bg-primary text-white" : "text-text-light hover:text-text-main")}>{x.label}</button>)}
                    </div>
                    {canManage && <button type="button" onClick={() => setAdding(true)} className="btn-primary"><Plus size={15} />Ajouter</button>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {[
                    { label: "Opérationnels", value: count(["operational"]), tone: "text-success" },
                    { label: "Dégradés ou critiques", value: count(["degraded", "critical"]), tone: count(["degraded", "critical"]) ? "text-warning" : "text-text-light" },
                    { label: "En maintenance", value: count(["maintenance"]), tone: count(["maintenance"]) ? "text-warning" : "text-text-light" },
                    { label: "Non prêts", value: count(["not_configured"]), tone: count(["not_configured"]) ? "text-danger" : "text-text-light" },
                    { label: "Succès global", value: totals.attempts ? percent((totals.success / totals.attempts) * 100, 0) : "—", tone: "text-primary" },
                ].map((k) => (
                    <div key={k.label} className="card p-4">
                        <p className={cn("text-2xl font-bold", k.tone)}>{isLoading ? "–" : k.value}</p>
                        <p className="text-xs text-text-light">{k.label}</p>
                    </div>
                ))}
            </div>

            {error && <p className="card p-4 text-sm text-danger">{(error as Error).message}</p>}
            <div className="grid gap-5 xl:grid-cols-2">
                {isLoading ? [0, 1].map((i) => <div key={i} className="skeleton h-96 rounded-2xl" />) : data.map((p) => <ProviderCard key={p.id} p={p} period={period} canManage={canManage} onSettings={() => setSettings(p)} />)}
            </div>

            {settings && <SettingsDialog provider={settings} onClose={() => setSettings(null)} />}
            {adding && <AddProvider onClose={() => setAdding(false)} />}
        </div>
    );
}
