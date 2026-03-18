"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/lib/api";
import { formatXAF, cn, healthStatusLabel } from "@/lib/utils";
import type { Provider } from "@/lib/types";
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    CheckCircle,
    Power,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    BarChart3,
    ShieldCheck
} from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

// ── Health Status Badge ────────────────────────────────────────────────────────

function HealthBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        operational: "bg-success-light text-success-dark",
        degraded: "bg-warning-light text-warning-dark",
        critical: "bg-danger-light text-danger-dark animate-pulse",
        idle: "bg-blue-50 text-blue-600",
        inactive: "bg-border text-text-light",
    };

    const icons: Record<string, React.ReactNode> = {
        operational: <CheckCircle2 size={12} />,
        degraded: <AlertTriangle size={12} />,
        critical: <AlertTriangle size={12} />,
        idle: <Activity size={12} />,
        inactive: <Power size={12} />,
    };

    return (
        <div className={cn("badge", styles[status] ?? "badge-neutral")}>
            {icons[status]}
            {healthStatusLabel(status)}
        </div>
    );
}

// ── Success Rate Ring ─────────────────────────────────────────────────────────

function SuccessRing({ rate }: { rate: number }) {
    const r = 32;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (rate / 100) * circumference;
    const color = rate >= 80 ? "#10b981" : rate >= 50 ? "#f59e0b" : "#ef4444";

    return (
        <div className="relative w-20 h-20 flex items-center justify-center">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r={r} stroke="#e2e8f0" strokeWidth="6" fill="none" />
                <circle
                    cx="40" cy="40" r={r}
                    stroke={color}
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                    style={{ transition: "stroke-dashoffset 1s ease" }}
                />
            </svg>
            <div className="absolute text-center">
                <p className="text-sm font-bold text-text-main">{rate}%</p>
            </div>
        </div>
    );
}

// ── Sparkline Panel ───────────────────────────────────────────────────────────

function ProviderSparkline({ providerId }: { providerId: number }) {
    const { data = [], isLoading } = useQuery({
        queryKey: ["provider", "sparkline", providerId],
        queryFn: () => adminApi.getProviderSparkline(providerId).then((r) => r.data.data),
    });

    if (isLoading) return <div className="skeleton h-24 rounded-xl" />;

    return (
        <div className="mt-4">
            <p className="text-xs text-text-light mb-2">Taux de succès — 48h</p>
            <ResponsiveContainer width="100%" height={80}>
                <LineChart data={data}>
                    <XAxis dataKey="hour" hide />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        formatter={(v: number) => [`${v}%`, "Succès"]}
                        labelFormatter={(l) => l.slice(-5)}
                    />
                    <Line
                        type="monotone"
                        dataKey="successRate"
                        stroke="#4f46e5"
                        strokeWidth={2}
                        dot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// ── Top Errors Panel ──────────────────────────────────────────────────────────

function ProviderErrors({ providerId }: { providerId: number }) {
    const { data = [], isLoading } = useQuery({
        queryKey: ["provider", "errors", providerId],
        queryFn: () => adminApi.getProviderErrors(providerId).then((r) => r.data.data),
    });

    if (isLoading) return <div className="skeleton h-20 rounded-xl mt-4" />;
    if (!data.length) return (
        <p className="text-xs text-text-light mt-4 text-center py-4 bg-background rounded-xl flex items-center justify-center gap-2">
            <ShieldCheck size={14} className="text-success" /> Aucune erreur sur les 24 dernières heures
        </p>
    );

    return (
        <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-text-light">Top erreurs (24h)</p>
            {data.slice(0, 4).map((e: any) => (
                <div key={e.errorCode} className="flex items-center justify-between p-2.5 bg-background rounded-xl">
                    <div>
                        <p className="text-xs font-mono font-semibold text-danger">{e.errorCode}</p>
                        <p className="text-xs text-text-light truncate max-w-[200px]">{e.errorMessage}</p>
                    </div>
                    <span className="badge badge-danger">{e.occurrences}×</span>
                </div>
            ))}
        </div>
    );
}

// ── Provider Card ─────────────────────────────────────────────────────────────

function ProviderCard({ provider }: { provider: Provider }) {
    const [expanded, setExpanded] = useState(false);
    const queryClient = useQueryClient();

    const toggleMutation = useMutation({
        mutationFn: () => adminApi.toggleProvider(provider.providerId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["providers"] });
        },
    });

    return (
        <div className={cn(
            "card p-6 transition-all duration-300",
            provider.healthStatus === "critical" && "border-danger/30 shadow-glow-danger/20"
        )}>
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow",
                        {
                            "bg-gradient-primary": provider.isActive && provider.healthStatus !== "critical",
                            "bg-danger": provider.healthStatus === "critical",
                            "bg-inactive": !provider.isActive,
                        }
                    )}>
                        {provider.code.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-text-main">{provider.name}</h3>
                        <p className="text-xs text-text-light font-mono">{provider.code}</p>
                    </div>
                </div>
                <HealthBadge status={provider.healthStatus} />
            </div>

            {/* Metrics row */}
            <div className="flex items-center gap-6">
                <SuccessRing rate={provider.successRate} />
                <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-text-light">Tentatives</span>
                        <span className="font-semibold text-text-main">{provider.totalAttempts}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-text-light flex items-center gap-1">
                            <CheckCircle2 size={10} className="text-success" /> Succès
                        </span>
                        <span className="font-semibold text-success">{provider.successCount}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-text-light flex items-center gap-1">
                            <AlertTriangle size={10} className="text-danger" /> Échecs
                        </span>
                        <span className="font-semibold text-danger">{provider.failureCount}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-text-light">Méthodes</span>
                        <div className="flex gap-1">
                            {provider.supportCard && <span className="badge badge-primary text-[10px] px-1.5">Card</span>}
                            {provider.supportMobileMoney && <span className="badge badge-neutral text-[10px] px-1.5">Mobile</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="animate-fade-in">
                    <ProviderSparkline providerId={provider.providerId} />
                    <ProviderErrors providerId={provider.providerId} />
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="btn-secondary flex-1 text-xs"
                >
                    <BarChart3 size={13} />
                    {expanded ? "Réduire" : "Détails + Erreurs"}
                    {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                <button
                    onClick={() => toggleMutation.mutate()}
                    disabled={toggleMutation.isPending}
                    className={cn(
                        "btn text-xs px-3",
                        provider.isActive ? "btn-danger" : "btn-primary"
                    )}
                    title={provider.isActive ? "Désactiver" : "Activer"}
                >
                    <Power size={13} />
                    {provider.isActive ? "Désactiver" : "Activer"}
                </button>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProvidersPage() {
    const [period, setPeriod] = useState<"1h" | "24h" | "7d">("24h");

    const { data = [], isLoading } = useQuery<Provider[]>({
        queryKey: ["providers", period],
        queryFn: () => adminApi.getProviders(period).then((r) => r.data.data),
        refetchInterval: 20 * 1000, // Refresh every 20s
    });

    const summary = {
        operational: data.filter((p) => p.healthStatus === "operational").length,
        degraded: data.filter((p) => p.healthStatus === "degraded").length,
        critical: data.filter((p) => p.healthStatus === "critical").length,
        inactive: data.filter((p) => !p.isActive).length,
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-slide-up">
            {/* Hero */}
            <div>
                <h1 className="page-title">
                    Provider <span className="gradient-text">Health Studio</span>
                </h1>
                <p className="text-sm text-text-light mt-1">
                    Surveillance temps réel de vos agrégateurs de paiement
                </p>
            </div>

            {/* Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: "Opérationnels", count: summary.operational, color: "text-operational" },
                    { label: "Dégradés", count: summary.degraded, color: "text-degraded" },
                    { label: "Critiques", count: summary.critical, color: "text-critical" },
                    { label: "Inactifs", count: summary.inactive, color: "text-inactive" },
                ].map((s) => (
                    <div key={s.label} className="card p-4 text-center">
                        <p className={cn("text-2xl font-extrabold", s.color)}>{s.count}</p>
                        <p className="text-xs text-text-light mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Period selector + Provider Grid */}
            <div className="section-header">
                <h2 className="section-title">Providers ({data.length})</h2>
                <div className="flex gap-1 bg-background rounded-xl p-1">
                    {(["1h", "24h", "7d"] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                period === p ? "bg-primary text-white shadow-sm" : "text-text-light hover:text-text-main"
                            )}
                        >
                            {p.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="card p-6">
                            <div className="skeleton h-11 w-11 rounded-xl mb-4" />
                            <div className="skeleton h-5 w-32 mb-2" />
                            <div className="skeleton h-3 w-20 mb-6" />
                            <div className="skeleton h-20 rounded-xl" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {data.map((provider) => (
                        <ProviderCard key={provider.providerId} provider={provider} />
                    ))}
                </div>
            )}
        </div>
    );
}
