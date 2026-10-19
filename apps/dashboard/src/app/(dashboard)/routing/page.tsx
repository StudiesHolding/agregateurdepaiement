"use client";

/**
 * Règles de priorité (ADR-0019, D2-D3)
 * ====================================
 * Une VOIE = pays × devise × moyen de paiement. Pour chaque voie, l'ordre d'essai des prestataires : le premier est
 * choisi, les suivants servent de bascule. Glisser une règle change l'ordre (priorités réécrites 10, 20, 30…).
 * Le simulateur rejoue exactement la décision du moteur et explique chaque règle écartée.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
    AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, CreditCard, GitBranch, GripVertical, Pencil, Play, Plus,
    Search, ShieldAlert, Smartphone, Trash2, Wrench, X, XCircle, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccess } from "@/lib/access";
import { CURRENCIES, METHOD_LABELS, PRIORITY_COUNTRIES, countryName, money, type PaymentMethod, type RuleMethod } from "@/lib/format";
import { isUsable, routingApi, type Lane, type MatrixProvider, type Rule, type RuleInput, type Simulation } from "@/lib/routing";

const MethodIcon = ({ method, size = 14 }: { method: RuleMethod; size?: number }) =>
    method === "card" ? <CreditCard size={size} /> : method === "mobile_money" ? <Smartphone size={size} /> : <Layers size={size} />;

const range = (r: Rule) => {
    if (r.minAmount && r.maxAmount) return `${money(r.minAmount, r.currency)} – ${money(r.maxAmount, r.currency)}`;
    if (r.maxAmount) return `jusqu’à ${money(r.maxAmount, r.currency)}`;
    if (r.minAmount) return `dès ${money(r.minAmount, r.currency)}`;
    return "tout montant";
};

/** Risques d'une voie : aucun prestataire utilisable, ou pas de bascule. */
function laneHealth(lane: Lane): { tone: "danger" | "warning" | "success"; label: string } {
    const usable = new Set(lane.rules.filter(isUsable).map((r) => r.provider!.id));
    if (usable.size === 0) return { tone: "danger", label: "Aucun prestataire disponible" };
    if (usable.size === 1) return { tone: "warning", label: "Sans bascule" };
    return { tone: "success", label: `${usable.size} prestataires, bascule assurée` };
}

// ── Règle (élément déplaçable) ────────────────────────────────────────────────

function RuleRow({ rule, position, canManage, onEdit, onToggle, onDelete }: {
    rule: Rule; position: number; canManage: boolean; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule.id, disabled: !canManage });
    const usable = isUsable(rule);
    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(
                "flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5",
                isDragging && "shadow-card-hover ring-2 ring-primary/30 z-10 relative",
                !usable && "opacity-70",
            )}
        >
            {canManage && (
                <button type="button" {...attributes} {...listeners} className="cursor-grab text-text-light hover:text-text-main active:cursor-grabbing" aria-label={`Déplacer ${rule.provider?.name}`}>
                    <GripVertical size={16} />
                </button>
            )}
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold", position === 1 && usable ? "bg-primary text-white" : "bg-background text-text-light")}>{position}</span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-main truncate">
                    {rule.provider?.name ?? "Prestataire supprimé"}
                    <span className="ml-2 text-xs font-normal text-text-light">{position === 1 ? "choisi en premier" : "bascule"}</span>
                </p>
                <p className="text-xs text-text-light">{range(rule)} · priorité {rule.priority}{rule.countryCode === "*" ? " · règle tous pays" : ""}</p>
            </div>
            <div className="hidden sm:flex flex-wrap justify-end gap-1">
                {!rule.isActive && <span className="badge badge-neutral">Désactivée</span>}
                {rule.provider && !rule.provider.isActive && <span className="badge badge-danger">Prestataire désactivé</span>}
                {rule.provider?.inMaintenance && <span className="badge badge-warning"><Wrench size={11} /> Maintenance</span>}
            </div>
            {canManage && (
                <div className="flex items-center gap-1">
                    <button type="button" onClick={onToggle} className="btn-ghost p-1.5 rounded-lg text-xs" title={rule.isActive ? "Désactiver la règle" : "Activer la règle"} aria-label={rule.isActive ? "Désactiver la règle" : "Activer la règle"}>
                        {rule.isActive ? <XCircle size={15} /> : <CheckCircle2 size={15} className="text-success" />}
                    </button>
                    <button type="button" onClick={onEdit} className="btn-ghost p-1.5 rounded-lg" aria-label="Modifier la règle"><Pencil size={15} /></button>
                    <button type="button" onClick={onDelete} className="btn-ghost p-1.5 rounded-lg text-danger" aria-label="Supprimer la règle"><Trash2 size={15} /></button>
                </div>
            )}
        </li>
    );
}

// ── Voie ──────────────────────────────────────────────────────────────────────

function LaneCard({ lane, canManage, onEdit, onAdd }: { lane: Lane; canManage: boolean; onEdit: (r: Rule) => void; onAdd: (lane: Lane) => void }) {
    const qc = useQueryClient();
    const [rules, setRules] = useState<Rule[]>(() => [...lane.rules].sort((a, b) => a.priority - b.priority || a.id - b.id));
    const [prevLane, setPrevLane] = useState(lane);
    if (prevLane !== lane) { setPrevLane(lane); setRules([...lane.rules].sort((a, b) => a.priority - b.priority || a.id - b.id)); }
    const health = laneHealth({ ...lane, rules });
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

    const refresh = () => qc.invalidateQueries({ queryKey: ["routing-matrix"] });
    const reorder = useMutation({
        mutationFn: (ids: number[]) => routingApi.reorder(ids),
        onSuccess: () => { toast.success("Ordre d’essai enregistré"); refresh(); },
        onError: (e: Error) => { toast.error(e.message); refresh(); },
    });
    const toggle = useMutation({
        mutationFn: (r: Rule) => routingApi.update(r.id, { isActive: !r.isActive }),
        onSuccess: (r) => { toast.success(r.isActive ? "Règle activée" : "Règle désactivée"); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const remove = useMutation({
        mutationFn: (r: Rule) => routingApi.remove(r.id),
        onSuccess: () => { toast.success("Règle supprimée"); refresh(); },
        onError: (e: Error) => toast.error(e.message),
    });

    const onDragEnd = (e: DragEndEvent) => {
        if (!e.over || e.active.id === e.over.id) return;
        const from = rules.findIndex((r) => r.id === e.active.id);
        const to = rules.findIndex((r) => r.id === e.over!.id);
        const next = arrayMove(rules, from, to);
        setRules(next);
        reorder.mutate(next.map((r) => r.id));
    };

    return (
        <article className="card p-5">
            <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-light text-xs font-bold text-primary">{lane.countryCode === "*" ? "TOUS" : lane.countryCode}</span>
                    <div>
                        <h3 className="text-sm font-bold text-text-main">{countryName(lane.countryCode)}</h3>
                        <p className="flex items-center gap-1.5 text-xs text-text-light"><MethodIcon method={lane.paymentMethod} size={12} />{METHOD_LABELS[lane.paymentMethod]} · {lane.currency}</p>
                    </div>
                </div>
                <span className={cn("badge", health.tone === "danger" ? "badge-danger" : health.tone === "warning" ? "badge-warning" : "badge-success")}>
                    {health.tone === "success" ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}{health.label}
                </span>
            </header>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                    <ol className="space-y-2">
                        {rules.map((r, i) => (
                            <RuleRow
                                key={r.id}
                                rule={r}
                                position={i + 1}
                                canManage={canManage}
                                onEdit={() => onEdit(r)}
                                onToggle={() => toggle.mutate(r)}
                                onDelete={() => { if (window.confirm(`Supprimer la règle ${r.provider?.name} · ${countryName(r.countryCode)} · ${r.currency} ?`)) remove.mutate(r); }}
                            />
                        ))}
                    </ol>
                </SortableContext>
            </DndContext>
            {canManage && (
                <button type="button" onClick={() => onAdd(lane)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs font-semibold text-text-light hover:border-primary hover:text-primary">
                    <Plus size={14} /> Ajouter un prestataire de bascule
                </button>
            )}
        </article>
    );
}

// ── Éditeur de règle ──────────────────────────────────────────────────────────

function RuleEditor({ initial, providers, onClose }: { initial: Partial<Rule> & { id?: number }; providers: MatrixProvider[]; onClose: () => void }) {
    const qc = useQueryClient();
    const [form, setForm] = useState<RuleInput & { providerId: number | undefined }>({
        providerId: initial.provider?.id ?? providers.find((p) => p.isActive)?.id,
        countryCode: initial.countryCode ?? "CM",
        currency: initial.currency ?? "XAF",
        paymentMethod: initial.paymentMethod ?? "mobile_money",
        minAmount: initial.minAmount ?? null,
        maxAmount: initial.maxAmount ?? null,
        priority: initial.priority ?? 10,
        isActive: initial.isActive ?? true,
    });
    const provider = providers.find((p) => p.id === form.providerId);
    const methodMismatch = provider && ((form.paymentMethod === "card" && !provider.supportCard) || (form.paymentMethod === "mobile_money" && !provider.supportMobileMoney));
    const save = useMutation({
        mutationFn: () => (initial.id ? routingApi.update(initial.id, form) : routingApi.create(form)),
        onSuccess: () => { toast.success(initial.id ? "Règle modifiée" : "Règle créée"); qc.invalidateQueries({ queryKey: ["routing-matrix"] }); onClose(); },
        onError: (e: Error) => toast.error(e.message),
    });
    const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
    const countries = Array.from(new Set([...PRIORITY_COUNTRIES, form.countryCode].filter((c) => c !== "*")));

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={initial.id ? "Modifier la règle" : "Nouvelle règle"} onClick={onClose}>
            <form className="card w-full max-w-lg p-6 animate-slide-up" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
                <div className="mb-5 flex items-start justify-between">
                    <div>
                        <h2 className="section-title">{initial.id ? "Modifier la règle" : "Nouvelle règle de priorité"}</h2>
                        <p className="text-xs text-text-light mt-1">Plus la priorité est petite, plus le prestataire est essayé tôt dans sa voie.</p>
                    </div>
                    <button type="button" onClick={onClose} className="btn-ghost p-1.5 rounded-lg" aria-label="Fermer"><X size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <label className="col-span-2 text-xs font-semibold text-text-light">Prestataire
                        <select className="input mt-1" value={form.providerId ?? ""} disabled={!!initial.id} onChange={(e) => set("providerId", Number(e.target.value))}>
                            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}{!p.isActive ? " (désactivé)" : p.inMaintenance ? " (maintenance)" : ""}</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-semibold text-text-light">Pays
                        <select className="input mt-1" value={form.countryCode} onChange={(e) => set("countryCode", e.target.value)}>
                            <option value="*">Tous les pays</option>
                            {countries.map((c) => <option key={c} value={c}>{countryName(c)} ({c})</option>)}
                        </select>
                    </label>
                    <label className="text-xs font-semibold text-text-light">Devise
                        <select className="input mt-1" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                            {Array.from(new Set([form.currency, ...CURRENCIES])).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </label>
                    <label className="col-span-2 text-xs font-semibold text-text-light">Moyen de paiement
                        <div className="mt-1 grid grid-cols-3 gap-2">
                            {(["mobile_money", "card", "any"] as RuleMethod[]).map((m) => (
                                <button key={m} type="button" onClick={() => set("paymentMethod", m)} className={cn("flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold", form.paymentMethod === m ? "border-primary bg-primary-light text-primary" : "border-border text-text-light hover:text-text-main")}>
                                    <MethodIcon method={m} /> {METHOD_LABELS[m]}
                                </button>
                            ))}
                        </div>
                    </label>
                    <label className="text-xs font-semibold text-text-light">Montant minimum
                        <input type="number" min={0} className="input mt-1" value={form.minAmount ?? ""} placeholder="0" onChange={(e) => set("minAmount", e.target.value === "" ? null : Number(e.target.value))} />
                    </label>
                    <label className="text-xs font-semibold text-text-light">Montant maximum
                        <input type="number" min={0} className="input mt-1" value={form.maxAmount ?? ""} placeholder="Sans plafond" onChange={(e) => set("maxAmount", e.target.value === "" ? null : Number(e.target.value))} />
                    </label>
                    <label className="text-xs font-semibold text-text-light">Priorité
                        <input type="number" min={0} max={1000} className="input mt-1" value={form.priority} onChange={(e) => set("priority", Number(e.target.value))} />
                    </label>
                    <label className="flex items-end gap-2 pb-2 text-xs font-semibold text-text-main">
                        <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-[#4f46e5]" /> Règle active
                    </label>
                </div>
                {methodMismatch && (
                    <p className="mt-4 flex items-start gap-2 rounded-xl bg-warning-light px-3 py-2 text-xs text-warning-dark"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{provider!.name} ne propose pas {METHOD_LABELS[form.paymentMethod]} : la règle sera toujours écartée.</p>
                )}
                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
                    <button type="submit" disabled={save.isPending || !form.providerId} className="btn-primary">{save.isPending ? "Enregistrement…" : initial.id ? "Enregistrer" : "Créer la règle"}</button>
                </div>
            </form>
        </div>
    );
}

// ── Simulateur ────────────────────────────────────────────────────────────────

function Simulator({ countries }: { countries: string[] }) {
    const [form, setForm] = useState({ countryCode: "CM", currency: "XAF", amount: 25000, paymentMethod: "mobile_money" as PaymentMethod });
    const [result, setResult] = useState<Simulation | null>(null);
    const [showExcluded, setShowExcluded] = useState(false);
    const run = useMutation({ mutationFn: () => routingApi.simulate(form), onSuccess: setResult, onError: (e: Error) => toast.error(e.message) });
    const excluded = result?.trace.filter((t) => t.status === "excluded" || t.status === "shadowed") ?? [];
    const list = Array.from(new Set([...countries.filter((c) => c !== "*"), ...PRIORITY_COUNTRIES]));

    return (
        <section className="card p-5 lg:sticky lg:top-20">
            <div className="mb-4 flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-light"><Play size={14} className="text-primary" /></span>
                <div>
                    <h2 className="text-sm font-bold text-text-main">Simulateur de décision</h2>
                    <p className="text-xs text-text-light">Rejoue exactement le choix du moteur.</p>
                </div>
            </div>
            <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); run.mutate(); }}>
                <label className="col-span-2 text-xs font-semibold text-text-light">Pays du client
                    <select className="input mt-1" value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })}>
                        {list.map((c) => <option key={c} value={c}>{countryName(c)} ({c})</option>)}
                    </select>
                </label>
                <label className="text-xs font-semibold text-text-light">Devise
                    <select className="input mt-1" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                        {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                </label>
                <label className="text-xs font-semibold text-text-light">Montant
                    <input type="number" min={1} className="input mt-1" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
                </label>
                <div className="col-span-2 grid grid-cols-2 gap-2">
                    {(["mobile_money", "card"] as PaymentMethod[]).map((m) => (
                        <button key={m} type="button" onClick={() => setForm({ ...form, paymentMethod: m })} className={cn("flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold", form.paymentMethod === m ? "border-primary bg-primary-light text-primary" : "border-border text-text-light")}>
                            <MethodIcon method={m} /> {METHOD_LABELS[m]}
                        </button>
                    ))}
                </div>
                <button type="submit" disabled={run.isPending} className="btn-primary col-span-2 justify-center"><Play size={14} />{run.isPending ? "Décision en cours…" : "Simuler"}</button>
            </form>

            {result && (
                <div className="mt-5 space-y-3 animate-fade-in">
                    {result.selectedProvider ? (
                        <div className="rounded-xl border border-success/20 bg-success-light p-3">
                            <p className="flex items-center gap-2 text-sm font-bold text-success-dark"><CheckCircle2 size={15} />{result.selectedProvider.providerName}</p>
                            <p className="mt-0.5 text-xs text-success-dark/80">{result.selectedProvider.why}</p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-danger/20 bg-danger-light p-3 text-danger-dark">
                            <p className="flex items-center gap-2 text-sm font-bold"><ShieldAlert size={15} />Aucun prestataire : le paiement serait refusé</p>
                            <p className="mt-0.5 text-xs">Ajoutez une règle pour {countryName(form.countryCode)} · {form.currency} · {METHOD_LABELS[form.paymentMethod]}.</p>
                        </div>
                    )}
                    {result.fallbackChain.length > 0 && (
                        <div>
                            <p className="mb-1.5 text-xs font-semibold text-text-light">En cas d’échec technique, bascule vers</p>
                            <ol className="space-y-1">
                                {result.fallbackChain.map((f) => (
                                    <li key={f.ruleId} className="flex items-center gap-2 text-xs text-text-main"><ArrowRight size={12} className="text-text-light" /><span className="font-semibold">{f.providerName}</span><span className="text-text-light">{f.why}</span></li>
                                ))}
                            </ol>
                        </div>
                    )}
                    {excluded.length > 0 && (
                        <div>
                            <button type="button" onClick={() => setShowExcluded((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-primary">
                                <ChevronDown size={13} className={cn("transition-transform", showExcluded && "rotate-180")} /> {excluded.length} règle(s) écartée(s) : pourquoi
                            </button>
                            {showExcluded && (
                                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto scroll-area">
                                    {excluded.map((t) => <li key={t.ruleId} className="text-xs text-text-light"><span className="font-semibold text-text-main">{t.provider}</span> — {t.reason}</li>)}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RoutingPage() {
    const { can } = useAccess();
    const canManage = can("psp.providers.manage");
    const { data, isLoading, error } = useQuery({ queryKey: ["routing-matrix"], queryFn: routingApi.matrix });
    const [editing, setEditing] = useState<(Partial<Rule> & { id?: number }) | null>(null);
    const [q, setQ] = useState("");
    const [method, setMethod] = useState<"" | RuleMethod>("");
    const [currency, setCurrency] = useState("");

    const lanes = useMemo(() => {
        const term = q.trim().toLowerCase();
        return (data?.lanes ?? []).filter((l) =>
            (!method || l.paymentMethod === method) && (!currency || l.currency === currency) &&
            (!term || l.countryCode.toLowerCase().includes(term) || countryName(l.countryCode).toLowerCase().includes(term) || l.rules.some((r) => r.provider?.name.toLowerCase().includes(term))));
    }, [data, q, method, currency]);

    const stats = useMemo(() => {
        const all = data?.lanes ?? [];
        const health = all.map(laneHealth);
        return {
            lanes: all.length,
            rules: all.reduce((n, l) => n + l.rules.filter((r) => r.isActive).length, 0),
            countries: new Set(all.map((l) => l.countryCode).filter((c) => c !== "*")).size,
            noFallback: health.filter((h) => h.tone === "warning").length,
            broken: health.filter((h) => h.tone === "danger").length,
        };
    }, [data]);

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="page-title">Règles de <span className="gradient-text">priorité</span></h1>
                    <p className="mt-1 max-w-2xl text-sm text-text-light">Quel prestataire encaisse chaque paiement, selon le pays du client, sa devise, son moyen de paiement et le montant. Le premier de chaque voie est choisi ; les suivants prennent le relais en cas d’échec technique.</p>
                </div>
                {canManage && <button type="button" onClick={() => setEditing({})} className="btn-primary"><Plus size={15} /> Nouvelle règle</button>}
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                {[
                    { label: "Voies de paiement", value: stats.lanes, icon: GitBranch, tone: "text-primary" },
                    { label: "Règles actives", value: stats.rules, icon: CheckCircle2, tone: "text-success" },
                    { label: "Pays couverts", value: stats.countries, icon: Layers, tone: "text-secondary" },
                    { label: "Voies sans bascule", value: stats.noFallback, icon: AlertTriangle, tone: stats.noFallback ? "text-warning" : "text-text-light" },
                    { label: "Voies sans prestataire", value: stats.broken, icon: ShieldAlert, tone: stats.broken ? "text-danger" : "text-text-light" },
                ].map((k) => (
                    <div key={k.label} className="card p-4">
                        <k.icon size={16} className={k.tone} />
                        <p className="mt-2 text-2xl font-bold text-text-main">{isLoading ? "–" : k.value}</p>
                        <p className="text-xs text-text-light">{k.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-4">
                    <div className="card flex flex-wrap items-center gap-3 p-3">
                        <label className="relative min-w-[200px] flex-1">
                            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light" />
                            <input className="input pl-9" placeholder="Pays, code ou prestataire" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une voie" />
                        </label>
                        <select className="input w-auto" value={method} onChange={(e) => setMethod(e.target.value as RuleMethod | "")} aria-label="Moyen de paiement">
                            <option value="">Tous les moyens</option>
                            <option value="mobile_money">Mobile Money</option>
                            <option value="card">Carte bancaire</option>
                            <option value="any">Règles « tous moyens »</option>
                        </select>
                        <select className="input w-auto" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Devise">
                            <option value="">Toutes les devises</option>
                            {Array.from(new Set((data?.lanes ?? []).map((l) => l.currency))).map((c) => <option key={c}>{c}</option>)}
                        </select>
                    </div>

                    {error && <p className="card p-4 text-sm text-danger">{(error as Error).message}</p>}
                    {isLoading && [0, 1, 2].map((i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
                    {!isLoading && lanes.length === 0 && (
                        <div className="card flex flex-col items-center gap-2 p-10 text-center">
                            <GitBranch size={28} className="text-text-light" />
                            <p className="text-sm font-semibold text-text-main">{data?.lanes.length ? "Aucune voie ne correspond aux filtres" : "Aucune règle configurée"}</p>
                            <p className="max-w-sm text-xs text-text-light">Sans règle, aucun paiement ne peut être encaissé. Créez une règle par pays, devise et moyen de paiement.</p>
                        </div>
                    )}
                    <div className="grid gap-4 xl:grid-cols-2">
                        {lanes.map((lane) => (
                            <LaneCard
                                key={`${lane.countryCode}|${lane.currency}|${lane.paymentMethod}`}
                                lane={lane}
                                canManage={canManage}
                                onEdit={(r) => setEditing(r)}
                                onAdd={(l) => setEditing({ countryCode: l.countryCode, currency: l.currency, paymentMethod: l.paymentMethod, priority: (Math.max(0, ...l.rules.map((r) => r.priority)) || 0) + 10 })}
                            />
                        ))}
                    </div>
                </div>
                <Simulator countries={(data?.lanes ?? []).map((l) => l.countryCode)} />
            </div>

            {editing && data && <RuleEditor initial={editing} providers={data.providers} onClose={() => setEditing(null)} />}
        </div>
    );
}
