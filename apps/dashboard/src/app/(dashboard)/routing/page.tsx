"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { RouteMatrix, RouteSimulationResult } from "@/lib/types";
import {
    Play,
    Plus,
    Trash2,
    CheckCircle2,
    XCircle,
    Map,
    Zap,
} from "lucide-react";

// ── Route Simulator ────────────────────────────────────────────────────────────

function RouteSimulator() {
    const [form, setForm] = useState({
        countryCode: "CM",
        currency: "XAF",
        amount: 25000,
        paymentMethod: "mobile_money",
    });
    const [result, setResult] = useState<RouteSimulationResult | null>(null);

    const mutation = useMutation({
        mutationFn: (payload: typeof form) => adminApi.simulateRoute(payload),
        onSuccess: (res) => setResult(res.data.data),
    });

    const countries = ["CM", "SN", "CI", "BJ", "BF", "ML", "TG", "NE", "GN", "FR", "US"];
    const currencies = ["XAF", "XOF", "USD", "EUR", "GHS", "NGN"];
    const methods = ["mobile_money", "card"];

    return (
        <div className="card p-6">
            <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center">
                    <Play size={14} className="text-primary" />
                </div>
                <h2 className="section-title">Simulateur de Routage</h2>
            </div>
            <p className="text-xs text-text-light mb-5">
                Testez le comportement du routage pour n&apos;importe quel scénario avant de modifier vos règles.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                    <label className="text-xs font-semibold text-text-light mb-1 block">Pays</label>
                    <select
                        className="input"
                        value={form.countryCode}
                        onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                    >
                        {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-text-light mb-1 block">Devise</label>
                    <select
                        className="input"
                        value={form.currency}
                        onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    >
                        {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold text-text-light mb-1 block">Montant</label>
                    <input
                        type="number"
                        className="input"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-text-light mb-1 block">Méthode</label>
                    <select
                        className="input"
                        value={form.paymentMethod}
                        onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    >
                        {methods.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
            </div>

            <button
                onClick={() => mutation.mutate(form)}
                disabled={mutation.isPending}
                className="btn-primary w-full justify-center"
            >
                <Play size={15} />
                {mutation.isPending ? "Simulation en cours…" : "Simuler le routage"}
            </button>

            {/* Result */}
            {result && (
                <div className="mt-5 animate-fade-in space-y-3">
                    <p className="text-xs font-semibold text-text-light">Résultat de la simulation</p>

                    {result.selectedProvider ? (
                        <>
                            <div className="p-3 bg-success-light border border-success/20 rounded-xl flex items-center gap-3">
                                <CheckCircle2 size={16} className="text-success flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-bold text-success-dark">
                                        Provider sélectionné : {result.selectedProvider.providerName}
                                    </p>
                                    <p className="text-xs text-success-dark/70">
                                        Priorité {result.selectedProvider.priority} • {result.selectedProvider.providerCode}
                                    </p>
                                </div>
                            </div>

                            {result.fallbackChain.length > 0 && (
                                <div>
                                    <p className="text-xs text-text-light mb-2">
                                        Chaîne de fallback ({result.fallbackChain.length})
                                    </p>
                                    <div className="space-y-1.5">
                                        {result.fallbackChain.map((p, i) => (
                                            <div key={p.providerId} className="flex items-center gap-2 p-2.5 bg-background rounded-xl text-xs">
                                                <span className="w-5 h-5 rounded-md bg-border flex items-center justify-center text-text-light font-bold text-[10px]">
                                                    {i + 2}
                                                </span>
                                                <span className="font-medium text-text-main">{p.providerName}</span>
                                                <span className="text-text-light ml-auto">{p.providerCode}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="p-3 bg-danger-light border border-danger/20 rounded-xl flex items-center gap-3">
                            <XCircle size={16} className="text-danger flex-shrink-0" />
                            <p className="text-sm font-bold text-danger-dark">
                                Aucun provider disponible pour ce scénario
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Route Matrix Table ─────────────────────────────────────────────────────────

function RouteMatrixView() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery<RouteMatrix>({
        queryKey: ["routes", "matrix"],
        queryFn: () => adminApi.getRouteMatrix().then((r) => r.data.data),
    });

    const deleteMutation = useMutation({
        mutationFn: (routeId: number) => adminApi.deleteRoute(routeId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["routes"] });
        },
    });

    if (isLoading) {
        return <div className="card p-6"><div className="skeleton h-64 rounded-xl" /></div>;
    }

    if (!data) return null;

    const { matrix, countries, providers } = data;

    return (
        <div className="card overflow-hidden">
            <div className="p-6 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-secondary-light flex items-center justify-center">
                        <Map size={14} className="text-secondary" />
                    </div>
                    <div>
                        <h2 className="section-title">Matrice Pays × Provider</h2>
                        <p className="text-xs text-text-light">{countries.length} pays configurés</p>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Pays</th>
                            {providers.map((p) => (
                                <th key={p.code}>{p.name}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {countries.map((country) => (
                            <tr key={country}>
                                <td>
                                    <span className="font-bold text-text-main">{country}</span>
                                </td>
                                {providers.map((provider) => {
                                    const route = matrix[country]?.[provider.code];
                                    return (
                                        <td key={provider.code}>
                                            {route ? (
                                                <div className="flex items-center gap-2">
                                                    <div className={cn(
                                                        "w-2.5 h-2.5 rounded-full",
                                                        route.isActive ? "bg-operational" : "bg-inactive"
                                                    )} />
                                                    <div>
                                                        <p className="text-xs font-semibold text-text-main">
                                                            P{route.priority}
                                                        </p>
                                                        <p className="text-[10px] text-text-light">{route.currency}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => deleteMutation.mutate(route.routeId)}
                                                        className="ml-2 text-text-light hover:text-danger transition-colors"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-border">—</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Add Route Form ─────────────────────────────────────────────────────────────

function AddRouteForm() {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        countryCode: "CM",
        currency: "XAF",
        priority: 1,
        providerId: "",
    });

    const { data: providers = [] } = useQuery({
        queryKey: ["providers", "24h"],
        queryFn: () => adminApi.getProviders("24h").then((r) => r.data.data),
    });

    const mutation = useMutation({
        mutationFn: (data: typeof form) => adminApi.createRoute(data as any),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["routes"] });
            setOpen(false);
            setForm({ countryCode: "CM", currency: "XAF", priority: 1, providerId: "" });
        },
    });

    if (!open) {
        return (
            <button onClick={() => setOpen(true)} className="btn-primary">
                <Plus size={15} />
                Ajouter une règle
            </button>
        );
    }

    return (
        <div className="card p-6 animate-slide-up">
            <h3 className="text-sm font-bold text-text-main mb-4">Nouvelle règle de routage</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="text-xs font-semibold text-text-light mb-1 block">Pays</label>
                    <input className="input" value={form.countryCode}
                        onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-text-light mb-1 block">Devise</label>
                    <input className="input" value={form.currency}
                        onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-text-light mb-1 block">Priorité</label>
                    <input type="number" min={1} className="input" value={form.priority}
                        onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
                </div>
                <div>
                    <label className="text-xs font-semibold text-text-light mb-1 block">Provider</label>
                    <select className="input" value={form.providerId}
                        onChange={(e) => setForm({ ...form, providerId: e.target.value })}>
                        <option value="">Sélectionner…</option>
                        {providers.map((p: any) => (
                            <option key={p.providerId} value={p.providerId}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="flex gap-2 justify-end">
                <button onClick={() => setOpen(false)} className="btn-secondary">Annuler</button>
                <button
                    onClick={() => mutation.mutate(form)}
                    disabled={mutation.isPending || !form.providerId}
                    className="btn-primary"
                >
                    <Plus size={14} />
                    {mutation.isPending ? "Création…" : "Créer la règle"}
                </button>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RoutingPage() {
    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-slide-up">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="page-title">
                        Route <span className="gradient-text">Builder</span>
                    </h1>
                    <p className="text-sm text-text-light mt-1">
                        Configurez et simulez vos règles de routage géographique
                    </p>
                </div>
                <AddRouteForm />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Matrix — 2/3 width */}
                <div className="xl:col-span-2">
                    <RouteMatrixView />
                </div>
                {/* Simulator — 1/3 width */}
                <RouteSimulator />
            </div>
        </div>
    );
}
