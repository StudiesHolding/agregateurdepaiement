"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AuditLog } from "@/lib/types";
import {
    ShieldCheck,
    Search,
    Calendar,
    User,
    Activity,
    ChevronLeft,
    ChevronRight,
    Info,
} from "lucide-react";

// ── Action Badge ───────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
    const isDanger = action.includes("DELETE") || action.includes("DISABLE") || action.includes("REMOVED");
    const isWarning = action.includes("UPDATE") || action.includes("TOGGLE") || action.includes("EDIT");
    const isSuccess = action.includes("CREATE") || action.includes("ENABLE") || action.includes("SUCCESS");

    return (
        <span className={cn(
            "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
            isDanger ? "bg-danger-light text-danger border-danger/20" :
                isWarning ? "bg-warning-light text-warning-dark border-warning/20" :
                    isSuccess ? "bg-success-light text-success-dark border-success/20" :
                        "bg-primary-light text-primary border-primary/20"
        )}>
            {action.replace(/_/g, " ")}
        </span>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AuditLogsPage() {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

    const { data, isLoading } = useQuery({
        queryKey: ["audit-logs", { page, search }],
        queryFn: () => adminApi.getAuditLogs({ page, search, limit: 50 }).then((r) => r.data),
        refetchInterval: 60 * 1000,
    });

    const logs: AuditLog[] = data?.data ?? [];
    const meta = data?.meta;

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="page-title">
                        Journal <span className="gradient-text">d&apos;Audit</span>
                    </h1>
                    <p className="text-sm text-text-light mt-1">
                        Traçabilité complète des actions administratives et modifications système
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center gap-2 px-3 border-r border-border">
                        <ShieldCheck size={16} className="text-primary" />
                        <span className="text-xs font-bold text-text-main">Audit Actif</span>
                    </div>
                    <span className="text-xs text-text-light pr-2">Conformité RGPD / PCI-DSS</span>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="card p-4 flex items-center gap-4">
                <div className="flex items-center gap-2 bg-background rounded-xl px-4 py-2.5 flex-1">
                    <Search size={16} className="text-text-light" />
                    <input
                        className="bg-transparent text-sm flex-1 outline-none placeholder:text-text-light"
                        placeholder="Rechercher par administrateur, action ou cible..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
                <button className="btn-secondary gap-2">
                    <Calendar size={14} />
                    Filtrer par date
                </button>
            </div>

            {/* Logs Table */}
            <div className="card overflow-hidden">
                {isLoading ? (
                    <div className="p-6 space-y-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Horodatage</th>
                                <th>Administrateur</th>
                                <th>Action</th>
                                <th>Cible</th>
                                <th>Détails</th>
                                <th>Adresse IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center text-text-light py-20 bg-background/50">
                                        <div className="flex flex-col items-center gap-3">
                                            <Info size={40} className="text-border" />
                                            <p>Aucun log d&apos;audit trouvé pour les critères sélectionnés.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="text-xs text-text-light">
                                            <div className="flex items-center gap-2">
                                                <Activity size={12} className="text-primary/50" />
                                                {new Date(log.createdAt).toLocaleString("fr-FR")}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-primary flex items-center justify-center text-[10px] text-white font-bold">
                                                    {log.adminIdentifier.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-semibold text-text-main">{log.adminIdentifier}</span>
                                            </div>
                                        </td>
                                        <td><ActionBadge action={log.action} /></td>
                                        <td>
                                            {log.targetType ? (
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-text-light uppercase">{log.targetType}</span>
                                                    <span className="text-xs font-mono text-text-main">{log.targetId || "—"}</span>
                                                </div>
                                            ) : (
                                                <span className="text-text-light text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="max-w-[200px]">
                                            <div className="text-[10px] text-text-light font-mono truncate hover:whitespace-normal hover:bg-background hover:p-2 rounded-lg cursor-help transition-all">
                                                {log.payload ? JSON.stringify(log.payload) : "—"}
                                            </div>
                                        </td>
                                        <td className="text-[10px] font-mono text-text-light">{log.ipAddress || "Interne"}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}

                {/* Pagination */}
                {meta && meta.totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background/30">
                        <p className="text-xs text-text-light">
                            Affichage de {logs.length} sur {meta.total} événements d&apos;audit
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="btn-secondary p-2 disabled:opacity-30"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, meta.totalPages) }).map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setPage(i + 1)}
                                        className={cn(
                                            "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                                            page === i + 1 ? "bg-primary text-white shadow-sm" : "hover:bg-border text-text-light"
                                        )}
                                    >
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                                disabled={page === meta.totalPages}
                                className="btn-secondary p-2 disabled:opacity-30"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Info */}
            <div className="p-6 bg-primary-light/10 border border-primary/10 rounded-3xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                    <Info size={20} />
                </div>
                <div>
                    <p className="text-xs font-bold text-primary-dark uppercase tracking-widest">Note Sécurité</p>
                    <p className="text-xs text-text-main mt-0.5">
                        Les logs d&apos;audit sont immuables et conservés pendant 365 jours. Toute modification des tables système est enregistrée avec l&apos;empreinte de l&apos;administrateur et son adresse IP source.
                    </p>
                </div>
            </div>
        </div>
    );
}
