"use client";

/**
 * Notifications (ADR-0019, D7)
 * ============================
 * Qui est prévenu, de quoi, par quel canal et quand : règles par événement (paiements, confirmations suspectes,
 * pics d'échecs, prestataires dégradés, rapprochement, résumé quotidien), seuils, destinataires, heures calmes,
 * anti-répétition, envoi d'essai et journal de chaque envoi.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, BellOff, CheckCircle2, Clock, Mail, Moon, Pencil, Plus, Send, Trash2, Volume2, X, XCircle, Zap, Radar, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccess } from "@/lib/access";
import { notificationsApi, playTone, type CatalogEvent, type Rule, type RuleInput, type Severity } from "@/lib/notifications";

const SEVERITY: Record<Severity, { label: string; badge: string }> = { info: { label: "Information", badge: "badge-primary" }, warning: { label: "À surveiller", badge: "badge-warning" }, danger: { label: "Urgent", badge: "badge-danger" } };
const CHANNEL = { inApp: { label: "Centre de notifications", icon: Bell }, email: { label: "E-mail", icon: Mail }, sound: { label: "Son", icon: Volume2 } } as const;
const TIMEZONES = ["Africa/Douala", "Africa/Abidjan", "Africa/Dakar", "Africa/Lagos", "Africa/Kinshasa", "Europe/Paris", "UTC"];

const paramSummary = (rule: Rule, def?: CatalogEvent) => {
    if (!def) return "";
    const p = rule.params;
    switch (rule.event) {
        case "payment.succeeded": return Number(p.minAmount) > 0 ? `À partir de ${Number(p.minAmount).toLocaleString("fr-FR")} ${p.currency}` : "Tous les paiements";
        case "failures.spike": return `Plus de ${p.failureRate} % d’échecs sur ${p.windowMinutes} min (au moins ${p.minAttempts} tentatives)`;
        case "provider.degraded": return `Succès sous ${p.successRate} % sur ${p.windowMinutes} min (au moins ${p.minAttempts} tentatives)`;
        case "webhook.backlog": return `Au moins ${p.minCount} notification(s) en attente depuis ${p.olderThanMinutes} min`;
        case "digest.daily": return `Chaque jour à ${String(p.hour).padStart(2, "0")} h (${rule.timezone})`;
        default: return def.kind === "instant" ? "À chaque occurrence" : "Vérifié toutes les 2 minutes";
    }
};

// ── Éditeur ───────────────────────────────────────────────────────────────────

function RuleEditor({ initial, catalog, onClose }: { initial: Partial<Rule> & { event: string }; catalog: CatalogEvent[]; onClose: () => void }) {
    const qc = useQueryClient();
    const def = catalog.find((c) => c.event === initial.event)!;
    const [form, setForm] = useState<RuleInput & { emailsText: string }>({
        event: initial.event, name: initial.name ?? "", enabled: initial.enabled ?? true, severity: initial.severity ?? def.severity,
        params: Object.fromEntries(Object.entries(def.params).map(([k, s]) => [k, initial.params?.[k] ?? s.default])),
        channels: { inApp: true, email: false, sound: false, ...(initial.channels ?? {}) },
        quietHours: initial.quietHours ?? null, timezone: initial.timezone ?? "Africa/Douala", cooldownMinutes: initial.cooldownMinutes ?? 60,
        emailsText: (initial.recipients?.emails ?? []).join(", "),
    });
    const save = useMutation({
        mutationFn: () => {
            const { emailsText, ...rest } = form;
            const body: RuleInput = { ...rest, recipients: { emails: emailsText.split(/[\s,;]+/).filter(Boolean) } };
            return initial.id ? notificationsApi.update(initial.id, body) : notificationsApi.create(body);
        },
        onSuccess: () => { toast.success(initial.id ? "Règle enregistrée" : "Règle créée"); qc.invalidateQueries({ queryKey: ["notification-rules"] }); onClose(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={def.label} onClick={onClose}>
            <form className="card max-h-[92vh] w-full max-w-xl overflow-y-auto p-6 animate-slide-up" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <h2 className="section-title">{def.label}</h2>
                        <p className="mt-1 text-xs text-text-light">{def.description}</p>
                    </div>
                    <button type="button" onClick={onClose} className="btn-ghost rounded-lg p-1.5" aria-label="Fermer"><X size={16} /></button>
                </div>

                <div className="grid gap-4">
                    <label className="text-xs font-semibold text-text-light">Nom (facultatif)
                        <input className="input mt-1" value={form.name ?? ""} placeholder={def.label} onChange={(e) => set("name", e.target.value)} />
                    </label>

                    {Object.keys(def.params).length > 0 && (
                        <fieldset className="grid grid-cols-2 gap-3 rounded-xl border border-border p-3">
                            <legend className="px-1 text-xs font-bold text-text-light">Déclenchement</legend>
                            {Object.entries(def.params).map(([k, spec]) => (
                                <label key={k} className="text-xs font-semibold text-text-light">{spec.label}
                                    {spec.type === "currency"
                                        ? <input className="input mt-1 uppercase" maxLength={3} value={String(form.params?.[k] ?? "")} onChange={(e) => set("params", { ...form.params, [k]: e.target.value.toUpperCase() })} />
                                        : <input type="number" className="input mt-1" min={spec.min} max={spec.max} value={Number(form.params?.[k] ?? 0)} onChange={(e) => set("params", { ...form.params, [k]: Number(e.target.value) })} />}
                                </label>
                            ))}
                        </fieldset>
                    )}

                    <fieldset className="rounded-xl border border-border p-3">
                        <legend className="px-1 text-xs font-bold text-text-light">Canaux</legend>
                        <div className="grid grid-cols-3 gap-2">
                            {(Object.keys(CHANNEL) as Array<keyof typeof CHANNEL>).map((c) => {
                                const Icon = CHANNEL[c].icon;
                                const on = !!form.channels?.[c];
                                return (
                                    <button key={c} type="button" aria-pressed={on} onClick={() => set("channels", { ...form.channels, [c]: !on })} className={cn("flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold", on ? "border-primary bg-primary-light text-primary" : "border-border text-text-light")}>
                                        <Icon size={14} />{CHANNEL[c].label}
                                    </button>
                                );
                            })}
                        </div>
                        {form.channels?.sound && <button type="button" onClick={() => playTone(form.severity === "danger" ? "DANGER" : form.severity === "warning" ? "WARNING" : "INFO")} className="mt-2 text-xs font-semibold text-primary">Écouter le signal</button>}
                    </fieldset>

                    {form.channels?.email && (
                        <label className="text-xs font-semibold text-text-light">Destinataires e-mail (séparés par des virgules)
                            <textarea className="input mt-1" rows={2} value={form.emailsText} placeholder="finance@studieslearning.com, direction@…" onChange={(e) => set("emailsText", e.target.value)} />
                        </label>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs font-semibold text-text-light">Gravité
                            <select className="input mt-1" value={form.severity} onChange={(e) => set("severity", e.target.value as Severity)}>
                                {(Object.keys(SEVERITY) as Severity[]).map((s) => <option key={s} value={s}>{SEVERITY[s].label}</option>)}
                            </select>
                        </label>
                        <label className="text-xs font-semibold text-text-light">Anti-répétition (minutes)
                            <input type="number" min={0} max={10080} className="input mt-1" value={form.cooldownMinutes ?? 60} onChange={(e) => set("cooldownMinutes", Number(e.target.value))} />
                        </label>
                    </div>

                    <fieldset className="rounded-xl border border-border p-3">
                        <legend className="px-1 text-xs font-bold text-text-light">Heures calmes</legend>
                        <label className="flex items-center gap-2 text-xs font-semibold text-text-main">
                            <input type="checkbox" className="h-4 w-4 accent-[#4f46e5]" checked={!!form.quietHours} onChange={(e) => set("quietHours", e.target.checked ? { from: "22:00", to: "07:00", allowDanger: true } : null)} />
                            Pas d’e-mail ni de son pendant une plage horaire (l’alerte reste visible dans le centre)
                        </label>
                        {form.quietHours && (
                            <div className="mt-3 grid grid-cols-3 gap-3">
                                <label className="text-xs font-semibold text-text-light">De<input type="time" className="input mt-1" value={form.quietHours.from} onChange={(e) => set("quietHours", { ...form.quietHours!, from: e.target.value })} /></label>
                                <label className="text-xs font-semibold text-text-light">À<input type="time" className="input mt-1" value={form.quietHours.to} onChange={(e) => set("quietHours", { ...form.quietHours!, to: e.target.value })} /></label>
                                <label className="flex items-end gap-2 pb-2 text-xs font-semibold text-text-main"><input type="checkbox" className="h-4 w-4 accent-[#ef4444]" checked={form.quietHours.allowDanger} onChange={(e) => set("quietHours", { ...form.quietHours!, allowDanger: e.target.checked })} />Urgences quand même</label>
                            </div>
                        )}
                        <label className="mt-3 block text-xs font-semibold text-text-light">Fuseau horaire
                            <select className="input mt-1" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
                                {Array.from(new Set([form.timezone ?? "Africa/Douala", ...TIMEZONES])).map((t) => <option key={t}>{t}</option>)}
                            </select>
                        </label>
                    </fieldset>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
                    <button type="submit" disabled={save.isPending} className="btn-primary">{save.isPending ? "Enregistrement…" : initial.id ? "Enregistrer" : "Créer la règle"}</button>
                </div>
            </form>
        </div>
    );
}

// ── Carte de règle ────────────────────────────────────────────────────────────

function RuleCard({ rule, def, canManage, onEdit }: { rule: Rule; def?: CatalogEvent; canManage: boolean; onEdit: () => void }) {
    const qc = useQueryClient();
    const refresh = () => { qc.invalidateQueries({ queryKey: ["notification-rules"] }); qc.invalidateQueries({ queryKey: ["notification-deliveries"] }); };
    const toggle = useMutation({ mutationFn: () => notificationsApi.update(rule.id, { enabled: !rule.enabled }), onSuccess: () => { toast.success(rule.enabled ? "Règle mise en pause" : "Règle activée"); refresh(); }, onError: (e: Error) => toast.error(e.message) });
    const test = useMutation({ mutationFn: () => notificationsApi.test(rule.id), onSuccess: (r) => { toast.success(r.message); refresh(); }, onError: (e: Error) => toast.error(e.message) });
    const remove = useMutation({ mutationFn: () => notificationsApi.remove(rule.id), onSuccess: () => { toast.success("Règle supprimée"); refresh(); }, onError: (e: Error) => toast.error(e.message) });
    const emailWithoutRecipient = rule.channels.email && rule.recipients.emails.length === 0;

    return (
        <article className={cn("card p-4", !rule.enabled && "opacity-70")}>
            <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="text-sm font-bold text-text-main">{rule.name || def?.label || rule.event}</h3>
                    <p className="text-xs text-text-light">{paramSummary(rule, def)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className={cn("badge", SEVERITY[rule.severity].badge)}>{SEVERITY[rule.severity].label}</span>
                    {!rule.enabled && <span className="badge badge-neutral">En pause</span>}
                </div>
            </header>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                {(Object.keys(CHANNEL) as Array<keyof typeof CHANNEL>).filter((c) => rule.channels[c]).map((c) => {
                    const Icon = CHANNEL[c].icon;
                    return <span key={c} className="badge badge-primary"><Icon size={11} />{CHANNEL[c].label}</span>;
                })}
                {rule.quietHours && <span className="badge badge-neutral"><Moon size={11} />{rule.quietHours.from}–{rule.quietHours.to}</span>}
                {rule.cooldownMinutes > 0 && <span className="badge badge-neutral"><Clock size={11} />1 fois / {rule.cooldownMinutes} min</span>}
            </div>
            {rule.channels.email && rule.recipients.emails.length > 0 && <p className="mt-2 truncate text-xs text-text-light" title={rule.recipients.emails.join(", ")}>E-mail : {rule.recipients.emails.join(", ")}</p>}
            {emailWithoutRecipient && <p className="mt-2 rounded-lg bg-warning-light px-2.5 py-1.5 text-xs text-warning-dark">E-mail activé sans destinataire : ajoutez au moins une adresse.</p>}
            {canManage && (
                <footer className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => toggle.mutate()} className="btn-secondary text-xs">{rule.enabled ? <><BellOff size={13} />Pause</> : <><Bell size={13} />Activer</>}</button>
                    <button type="button" onClick={onEdit} className="btn-secondary text-xs"><Pencil size={13} />Régler</button>
                    <button type="button" onClick={() => test.mutate()} disabled={test.isPending} className="btn-secondary text-xs"><Send size={13} />{test.isPending ? "Envoi…" : "Essai"}</button>
                    <button type="button" onClick={() => { if (window.confirm("Supprimer cette règle ?")) remove.mutate(); }} className="btn-ghost ml-auto rounded-lg p-1.5 text-danger" aria-label="Supprimer la règle"><Trash2 size={14} /></button>
                </footer>
            )}
        </article>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
    const { can } = useAccess();
    const canManage = can("psp.operations.manage");
    const catalog = useQuery({ queryKey: ["notification-catalog"], queryFn: notificationsApi.catalog });
    const rules = useQuery({ queryKey: ["notification-rules"], queryFn: notificationsApi.rules });
    const deliveries = useQuery({ queryKey: ["notification-deliveries"], queryFn: () => notificationsApi.deliveries(60), refetchInterval: 60_000 });
    const [editing, setEditing] = useState<(Partial<Rule> & { event: string }) | null>(null);
    const [adding, setAdding] = useState(false);
    const defs = useMemo(() => new Map((catalog.data ?? []).map((c) => [c.event, c])), [catalog.data]);
    const group = (kind: "instant" | "watch") => (rules.data ?? []).filter((r) => defs.get(r.event)?.kind === kind);

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="page-title"><span className="gradient-text">Notifications</span></h1>
                    <p className="mt-1 max-w-2xl text-sm text-text-light">Qui est prévenu, de quoi, par quel canal et quand. Les surveillances sont vérifiées toutes les deux minutes ; chaque envoi est journalisé.</p>
                </div>
                {canManage && <button type="button" onClick={() => setAdding(true)} className="btn-primary"><Plus size={15} />Nouvelle règle</button>}
            </div>

            {(rules.error || catalog.error) && <p className="card p-4 text-sm text-danger">{((rules.error || catalog.error) as Error).message}</p>}

            {[{ kind: "instant" as const, title: "Événements instantanés", icon: Zap, hint: "Envoyés au moment où l’événement se produit." }, { kind: "watch" as const, title: "Surveillances", icon: Radar, hint: "Seuils évalués en continu sur une fenêtre glissante." }].map((g) => (
                <section key={g.kind} className="space-y-3">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-text-main"><g.icon size={15} className="text-primary" />{g.title}<span className="text-xs font-normal text-text-light">{g.hint}</span></h2>
                    {rules.isLoading ? <div className="skeleton h-32 rounded-2xl" /> : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {group(g.kind).map((r) => <RuleCard key={r.id} rule={r} def={defs.get(r.event)} canManage={canManage} onEdit={() => setEditing(r)} />)}
                        </div>
                    )}
                </section>
            ))}

            <section className="card p-5">
                <h2 className="mb-3 text-sm font-bold text-text-main">Journal d’envoi</h2>
                {deliveries.isLoading ? <div className="skeleton h-32 rounded-xl" /> : (deliveries.data?.length ?? 0) === 0 ? <p className="text-xs text-text-light">Aucun envoi pour l’instant.</p> : (
                    <div className="overflow-x-auto">
                        <table className="data-table w-full text-xs">
                            <thead><tr><th>Date</th><th>Alerte</th><th>Canal</th><th>Destinataire</th><th>Issue</th></tr></thead>
                            <tbody>
                                {deliveries.data!.map((d) => (
                                    <tr key={d.id}>
                                        <td className="whitespace-nowrap">{new Date(d.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                                        <td className="max-w-[320px] truncate" title={d.title}>{d.title}</td>
                                        <td>{CHANNEL[d.channel]?.label ?? d.channel}</td>
                                        <td className="text-text-light">{d.recipient ?? "—"}</td>
                                        <td>
                                            {d.status === "sent" ? <span className="badge badge-success"><CheckCircle2 size={11} />Envoyé</span>
                                                : d.status === "failed" ? <span className="badge badge-danger" title={d.detail ?? ""}><XCircle size={11} />Échec</span>
                                                : <span className="badge badge-neutral" title={d.detail ?? ""}><MinusCircle size={11} />{d.detail ?? "Ignoré"}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {adding && catalog.data && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Nouvelle règle" onClick={() => setAdding(false)}>
                    <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-4 flex items-start justify-between"><h2 className="section-title">Choisir l’événement</h2><button type="button" onClick={() => setAdding(false)} className="btn-ghost rounded-lg p-1.5" aria-label="Fermer"><X size={16} /></button></div>
                        <ul className="space-y-2">
                            {catalog.data.map((c) => (
                                <li key={c.event}>
                                    <button type="button" onClick={() => { setAdding(false); setEditing({ event: c.event }); }} className="w-full rounded-xl border border-border p-3 text-left hover:border-primary">
                                        <span className="flex items-center justify-between gap-2 text-sm font-semibold text-text-main">{c.label}<span className={cn("badge", SEVERITY[c.severity].badge)}>{c.kind === "instant" ? "Instantané" : "Surveillance"}</span></span>
                                        <span className="mt-0.5 block text-xs text-text-light">{c.description}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
            {editing && catalog.data && <RuleEditor initial={editing} catalog={catalog.data} onClose={() => setEditing(null)} />}
        </div>
    );
}
