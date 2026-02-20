"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/lib/api";
import { formatXAF, formatTrend, cn } from "@/lib/utils";
import {
    TrendingUp,
    TrendingDown,
    CreditCard,
    CheckCircle2,
    GitFork,
    Zap,
    RefreshCw,
} from "lucide-react";
import type { OverviewKpis, TimeSeriesPoint } from "@/lib/types";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

// ── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
    title: string;
    value: string;
    trend?: number;
    sub?: string;
    icon: React.ReactNode;
    colorClass?: string;
    loading?: boolean;
}

function KpiCard({ title, value, trend, sub, icon, colorClass = "bg-primary-light text-primary", loading }: KpiCardProps) {
    if (loading) {
        return (
            <div className="kpi-card">
                <div className="skeleton h-4 w-24 mb-4" />
                <div className="skeleton h-8 w-36 mb-2" />
                <div className="skeleton h-3 w-20" />
            </div>
        );
    }

    return (
        <div className="kpi-card group hover:-translate-y-1 transition-all duration-300">
            {/* Background glow on hover */}
            <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity" />

            <div className="flex items-start justify-between mb-4">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colorClass)}>
                    {icon}
                </div>
                {trend !== undefined && (
                    <div className={cn(
                        "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                        trend >= 0 ? "bg-success-light text-success-dark" : "bg-danger-light text-danger-dark"
                    )}>
                        {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {formatTrend(trend)}
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <p className="text-xs font-semibold text-text-light uppercase tracking-wider">{title}</p>
                <p className="text-2xl font-bold text-text-main">{value}</p>
                {sub && <p className="text-xs text-text-light">{sub}</p>}
            </div>
        </div>
    );
}

// ── Revenue Chart ────────────────────────────────────────────────────────────

function RevenueChart({ data, period, onPeriodChange }: {
    data: TimeSeriesPoint[];
    period: string;
    onPeriodChange: (p: string) => void;
}) {
    const periods = ["24h", "7d", "30d", "90d"];

    return (
        <div className="card p-6">
            <div className="section-header">
                <div>
                    <h2 className="section-title">Évolution des Revenus</h2>
                    <p className="text-xs text-text-light mt-0.5">Transactions succeeded</p>
                </div>
                <div className="flex gap-1 bg-background rounded-xl p-1">
                    {periods.map((p) => (
                        <button
                            key={p}
                            onClick={() => onPeriodChange(p)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                period === p
                                    ? "bg-primary text-white shadow-sm"
                                    : "text-text-light hover:text-text-main"
                            )}
                        >
                            {p.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                        dataKey="period"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => v.slice(-5)}
                    />
                    <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "#fff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "12px",
                            fontSize: "12px",
                        }}
                        formatter={(value: number) => [formatXAF(value), "Revenus"]}
                    />
                    <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        fill="url(#revenueGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: "#4f46e5" }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// ── Provider Overview ─────────────────────────────────────────────────────────

function ProviderOverview() {
    const { data, isLoading } = useQuery({
        queryKey: ["providers", "24h"],
        queryFn: () => adminApi.getProviderPerformance("24h").then((r) => r.data.data),
        refetchInterval: 30 * 1000,
    });

    const statusColor = (status: string) => {
        const m: Record<string, string> = {
            operational: "bg-operational",
            degraded: "bg-degraded",
            critical: "bg-critical",
            idle: "bg-idle",
            inactive: "bg-inactive",
        };
        return m[status] ?? "bg-border";
    };

    const statusLabel = (status: string) => ({
        operational: "Opérationnel",
        degraded: "Dégradé",
        critical: "Critique",
        idle: "Idle",
        inactive: "Inactif",
    }[status] ?? status);

    return (
        <div className="card p-6">
            <div className="section-header">
                <h2 className="section-title">Santé des Providers</h2>
                <span className="text-xs text-text-light bg-background px-2 py-1 rounded-lg">24h</span>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="skeleton h-12 rounded-xl" />
                    ))}
                </div>
            ) : (
                <ul className="space-y-2">
                    {(data || []).map((p: any) => (
                        <li
                            key={p.providerId}
                            className="flex items-center justify-between p-3 rounded-xl bg-background hover:bg-border/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn("status-dot", p.healthStatus, statusColor(p.healthStatus), "w-2.5 h-2.5 rounded-full")} />
                                <span className="text-sm font-medium text-text-main">{p.name}</span>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-text-main">{p.successRate}%</p>
                                <p className="text-xs text-text-light">{statusLabel(p.healthStatus)}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
    const [period, setPeriod] = useState("30d");

    const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useQuery<OverviewKpis>({
        queryKey: ["kpis", "overview"],
        queryFn: () => adminApi.getOverviewKpis().then((r) => r.data.data),
        refetchInterval: 30 * 1000,
    });

    const { data: timeSeries = [], isLoading: tsLoading, refetch: refetchTs } = useQuery<TimeSeriesPoint[]>({
        queryKey: ["kpis", "timeseries", period],
        queryFn: () => adminApi.getTimeSeries(period).then((r) => r.data.data),
    });

    function handleRefresh() {
        refetchKpis();
        refetchTs();
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-slide-up">
            {/* Hero header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="page-title">
                        Command{" "}
                        <span className="gradient-text">Center</span>
                    </h1>
                    <p className="text-sm text-text-light mt-1">
                        Vue globale de votre infrastructure de paiement — Studies Learning PSP
                    </p>
                </div>
                <button onClick={handleRefresh} className="btn-secondary gap-2">
                    <RefreshCw size={14} />
                    Actualiser
                </button>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard
                    loading={kpisLoading}
                    title="Revenus (24h)"
                    value={kpis ? formatXAF(kpis.revenue24h) : "—"}
                    trend={kpis?.trends.revenue}
                    sub="Transactions succeeded"
                    icon={<CreditCard size={18} />}
                    colorClass="bg-primary-light text-primary"
                />
                <KpiCard
                    loading={kpisLoading}
                    title="Transactions (24h)"
                    value={kpis ? String(kpis.transactionCount24h) : "—"}
                    trend={kpis?.trends.transactions}
                    sub="intentions de paiement"
                    icon={<Zap size={18} />}
                    colorClass="bg-secondary-light text-secondary"
                />
                <KpiCard
                    loading={kpisLoading}
                    title="Taux de Succès"
                    value={kpis ? `${kpis.successRate}%` : "—"}
                    sub="sur les 24 dernières heures"
                    icon={<CheckCircle2 size={18} />}
                    colorClass="bg-success-light text-success"
                />
                <KpiCard
                    loading={kpisLoading}
                    title="Taux de Failover"
                    value={kpis ? `${kpis.failoverRate}%` : "—"}
                    sub={kpis ? `${kpis.failoverCount} intentions en failover` : ""}
                    icon={<GitFork size={18} />}
                    colorClass="bg-warning-light text-warning"
                />
            </div>

            {/* Revenue Chart + Provider Overview */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                    {tsLoading ? (
                        <div className="card p-6">
                            <div className="skeleton h-8 w-48 mb-6" />
                            <div className="skeleton h-60 rounded-xl" />
                        </div>
                    ) : (
                        <RevenueChart
                            data={timeSeries}
                            period={period}
                            onPeriodChange={setPeriod}
                        />
                    )}
                </div>
                <ProviderOverview />
            </div>

            {/* Footer note */}
            <p className="text-xs text-text-light text-center pb-2">
                Données actualisées automatiquement toutes les 30 secondes • Studies PSP v1.0
            </p>
        </div>
    );
}
