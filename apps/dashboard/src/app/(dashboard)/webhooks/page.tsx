"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { WebhookEvent, WebhookStats } from "@/lib/types";
import { RefreshCw, CheckCircle2, AlertTriangle, Clock, RotateCcw } from "lucide-react";

function StatCard({ label, value, icon, color }: {
    label: string; value: string | number; icon: React.ReactNode; color: string;
}) {
    return (
        <div className="card p-4 flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
                {icon}
            </div>
            <div>
                <p className="text-xl font-bold text-text-main">{value}</p>
                <p className="text-xs text-text-light">{label}</p>
            </div>
        </div>
    );
}

export default function WebhooksPage() {
    const [page, setPage] = useState(1);
    const [processed, setProcessed] = useState<string>("");
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ["webhooks", { processed, page }],
        queryFn: () =>
            adminApi.getWebhooks({ ...(processed !== "" && { processed }), page, limit: 50 })
                .then((r) => r.data),
        refetchInterval: 20 * 1000,
    });

    const stats: WebhookStats | undefined = data?.stats;
    const events: WebhookEvent[] = data?.data ?? [];

    const replayMutation = useMutation({
        mutationFn: (id: number) => adminApi.replayWebhook(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["webhooks"] });
        },
    });

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-slide-up">
            <div>
                <h1 className="page-title">
                    Webhook <span className="gradient-text">Monitor</span>
                </h1>
                <p className="text-sm text-text-light mt-1">
                    Surveillance et rejoue des événements webhook — 24h glissantes
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard
                    label="Total (24h)"
                    value={stats?.total24h ?? "—"}
                    icon={<RefreshCw size={16} />}
                    color="bg-primary-light text-primary"
                />
                <StatCard
                    label="Traités"
                    value={`${stats?.processingRate ?? 0}%`}
                    icon={<CheckCircle2 size={16} />}
                    color="bg-success-light text-success"
                />
                <StatCard
                    label="Signatures invalides"
                    value={stats?.invalidSignatureCount ?? "—"}
                    icon={<AlertTriangle size={16} />}
                    color="bg-danger-light text-danger"
                />
                <StatCard
                    label="En attente"
                    value={stats?.pendingCount ?? "—"}
                    icon={<Clock size={16} />}
                    color="bg-warning-light text-warning"
                />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-4">
                <div className="flex gap-1 bg-white border border-border rounded-xl p-1">
                    {[
                        { label: "Tous", value: "" },
                        { label: "Traités", value: "true" },
                        { label: "En attente", value: "false" },
                    ].map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => { setProcessed(opt.value); setPage(1); }}
                            className={cn(
                                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                processed === opt.value ? "bg-primary text-white shadow-sm" : "text-text-light hover:text-text-main"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Events Table */}
            <div className="card overflow-hidden">
                {isLoading ? (
                    <div className="p-6 space-y-3">
                        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Provider</th>
                                <th>Type</th>
                                <th>Signature</th>
                                <th>Statut</th>
                                <th>Tentatives</th>
                                <th>Date</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center text-text-light py-12">
                                        Aucun événement webhook
                                    </td>
                                </tr>
                            ) : (
                                events.map((e) => (
                                    <tr key={e.id}>
                                        <td className="font-mono text-xs text-text-light">#{e.id}</td>
                                        <td>
                                            <span className="badge badge-primary text-xs">{e.provider}</span>
                                        </td>
                                        <td className="font-mono text-xs">{e.eventType}</td>
                                        <td>
                                            {e.signatureValid ? (
                                                <CheckCircle2 size={14} className="text-success" />
                                            ) : (
                                                <AlertTriangle size={14} className="text-danger" />
                                            )}
                                        </td>
                                        <td>
                                            {e.processed ? (
                                                <span className="badge badge-success">Traité</span>
                                            ) : (
                                                <span className="badge badge-warning">En attente</span>
                                            )}
                                        </td>
                                        <td className="text-xs text-text-light text-center">{e.retryCount}</td>
                                        <td className="text-xs text-text-light">
                                            {new Date(e.createdAt).toLocaleString("fr-FR")}
                                        </td>
                                        <td>
                                            {!e.processed && (
                                                <button
                                                    onClick={() => replayMutation.mutate(e.id)}
                                                    disabled={replayMutation.isPending}
                                                    className="btn-ghost p-1.5 rounded-lg text-primary hover:bg-primary-light"
                                                    title="Rejouer"
                                                >
                                                    <RotateCcw size={13} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
