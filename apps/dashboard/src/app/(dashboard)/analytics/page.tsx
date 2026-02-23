"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/lib/api";
import { formatXAF, formatCompact, cn } from "@/lib/utils";
import type { LmsAnalytics, TopFormation } from "@/lib/types";
import {
    BookOpen,
    Users,
    Wallet,
    ArrowUpRight,
    TrendingUp,
    GraduationCap,
    Calendar,
    Layers,
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";

// ── Analytics Card ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, colorClass }: {
    label: string; value: string | number; sub?: string; icon: React.ReactNode; colorClass: string;
}) {
    return (
        <div className="card p-6 flex items-center gap-5">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm", colorClass)}>
                {icon}
            </div>
            <div>
                <p className="text-2xl font-bold text-text-main">{value}</p>
                <p className="text-xs font-semibold text-text-light uppercase tracking-wider">{label}</p>
                {sub && <p className="text-xs text-primary font-medium mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ── Top Formations Table ──────────────────────────────────────────────────────

function TopFormationsTable({ formations }: { formations: TopFormation[] }) {
    return (
        <div className="card overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <BookOpen size={18} className="text-primary" />
                    <h2 className="section-title">Formations les plus vendues</h2>
                </div>
                <span className="text-xs text-text-light bg-background px-2 py-1 rounded-lg">Top 10</span>
            </div>
            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Formation</th>
                            <th>Ventes</th>
                            <th>Chiffre d'Affaires</th>
                            <th>Panier Moyen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {formations.map((f) => (
                            <tr key={f.courseId}>
                                <td className="max-w-[250px]">
                                    <p className="text-sm font-bold text-text-main truncate">{f.courseName}</p>
                                    <p className="text-[10px] text-text-light uppercase tracking-tighter">ID: {f.courseId} • {f.packageType || "Standard"}</p>
                                </td>
                                <td className="text-sm font-semibold">{f.salesCount}</td>
                                <td className="text-sm font-bold text-primary">{formatXAF(f.totalRevenue)}</td>
                                <td className="text-xs text-text-light">{formatXAF(f.avgAmount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Wallet Summary Panel ─────────────────────────────────────────────────────

function WalletPanel({ wallet }: { wallet: LmsAnalytics["walletSummary"] }) {
    if (!wallet) return null;

    return (
        <div className="space-y-6">
            <div className="card p-6 bg-gradient-to-br from-primary to-primary-dark text-white border-none shadow-glow">
                <div className="flex items-start justify-between mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                        <Wallet size={24} />
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-white/70 uppercase font-bold tracking-widest">Balance Totale Wallets</p>
                        <p className="text-3xl font-extrabold">{formatXAF(wallet.totalBalance)}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                    <div>
                        <p className="text-[10px] text-white/60 uppercase">Cumul Gains Formateurs</p>
                        <p className="text-lg font-bold">{formatCompact(wallet.totalEarned)} XAF</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-white/60 uppercase">Revenus ce mois</p>
                        <p className="text-lg font-bold">+{formatCompact(wallet.monthlyCredit)} XAF</p>
                    </div>
                </div>
            </div>

            <div className="card p-6">
                <div className="flex items-center gap-2 mb-5">
                    <Users size={18} className="text-primary" />
                    <h2 className="section-title">Top Formateurs</h2>
                </div>
                <div className="space-y-4">
                    {wallet.topFormateurs.map((f, i) => (
                        <div key={f.email} className="flex items-center gap-3 p-3 rounded-2xl bg-background border border-transparent hover:border-primary/20 transition-all cursor-default group">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-bold text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-colors">
                                {f.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-text-main truncate">{f.name}</p>
                                <p className="text-[10px] text-text-light truncate">{f.formationCount} formations publiées</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-text-main">{formatCompact(f.totalEarned)}</p>
                                <p className="text-[10px] text-success font-bold">Gains</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Revenue By Course Chart ──────────────────────────────────────────────────

function RevenueChart({ formations }: { formations: TopFormation[] }) {
    const data = formations.slice(0, 5).map(f => ({
        name: f.courseName.length > 15 ? f.courseName.substring(0, 15) + '...' : f.courseName,
        revenue: f.totalRevenue,
        fullName: f.courseName
    }));

    return (
        <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-success" />
                    <h2 className="section-title">CA par Formation (Top 5)</h2>
                </div>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            axisLine={false}
                            tickLine={false}
                            width={100}
                            tick={{ fontSize: 11, fontWeight: 600, fill: "#64748b" }}
                        />
                        <Tooltip
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            formatter={(value: number) => [formatXAF(value), "Chiffre d'Affaires"]}
                        />
                        <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={32}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'][index % 5]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsLmsPage() {
    const [period, setPeriod] = useState("30d");

    const { data, isLoading } = useQuery<LmsAnalytics>({
        queryKey: ["analytics", "lms", period],
        queryFn: () => adminApi.getLmsAnalytics(period).then((r) => r.data.data),
        refetchInterval: 60 * 1000,
    });

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-slide-up">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="page-title">
                        Analytics <span className="gradient-text">LMS</span>
                    </h1>
                    <p className="text-sm text-text-light mt-1">
                        Performance des formations et état financier des formateurs (Business Intelligence)
                    </p>
                </div>
                <div className="flex gap-1 bg-white border border-border rounded-xl p-1 shadow-sm">
                    {(["7d", "30d", "90d"] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={cn(
                                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                                period === p ? "bg-primary text-white shadow-md" : "text-text-light hover:text-text-main"
                            )}
                        >
                            {p.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Hero Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Total Formations"
                    value={data?.formationsStats?.totalPublished ?? "—"}
                    sub={data?.formationsStats?.newThisMonth ? `+${data.formationsStats.newThisMonth} ce mois` : undefined}
                    icon={<GraduationCap size={24} />}
                    colorClass="bg-primary-light text-primary"
                />
                <StatCard
                    label="Wallets Actifs"
                    value={data?.walletSummary?.activeWallets ?? "—"}
                    sub="Partenaires formateurs"
                    icon={<Users size={24} />}
                    colorClass="bg-secondary-light text-secondary"
                />
                <StatCard
                    label="Volume Ventes (période)"
                    value={data?.topFormations?.reduce((acc, f) => acc + f.salesCount, 0) ?? "—"}
                    sub="Cours vendus par le PSP"
                    icon={<ArrowUpRight size={24} />}
                    colorClass="bg-success-light text-success"
                />
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                    <TopFormationsTable formations={data?.topFormations ?? []} />
                    <RevenueChart formations={data?.topFormations ?? []} />
                </div>
                <div className="xl:col-span-1">
                    <WalletPanel wallet={data?.walletSummary ?? null} />
                </div>
            </div>

            {isLoading && (
                <div className="fixed inset-0 bg-white/50 backdrop-blur-[2px] z-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-3xl shadow-xl flex items-center gap-4">
                        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-bold text-text-main">Chargement des données LMS...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
