"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/lib/api";
import { formatXAF, cn } from "@/lib/utils";
import type { Transaction, PaymentStatus } from "@/lib/types";
import { Search, Filter, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";

// ── Status Badge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PaymentStatus | string }) {
    const styles: Record<string, string> = {
        succeeded: "badge-success",
        failed: "badge-danger",
        pending: "badge-warning",
        processing: "badge-primary",
        refunded: "badge-neutral",
    };
    const labels: Record<string, string> = {
        succeeded: "Succès",
        failed: "Échoué",
        pending: "En attente",
        processing: "En cours",
        refunded: "Remboursé",
    };
    return <span className={cn("badge", styles[status] ?? "badge-neutral")}>{labels[status] ?? status}</span>;
}

// ── Filters ────────────────────────────────────────────────────────────────────

interface Filters {
    status: string;
    provider: string;
    currency: string;
    search: string;
    from: string;
    to: string;
    lmsItemId: string;
    lmsItemType: string;
}

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
    return (
        <div className="card p-4 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 bg-background rounded-xl px-3 py-2 flex-1 min-w-[200px]">
                <Search size={14} className="text-text-light" />
                <input
                    className="bg-transparent text-sm flex-1 outline-none placeholder:text-text-light"
                    placeholder="Email, référence commande…"
                    value={filters.search}
                    onChange={(e) => onChange({ ...filters, search: e.target.value })}
                />
            </div>

            {/* Status */}
            <select
                className="input w-auto text-sm"
                value={filters.status}
                onChange={(e) => onChange({ ...filters, status: e.target.value })}
            >
                <option value="">Tous les statuts</option>
                <option value="succeeded">Succès</option>
                <option value="failed">Échoués</option>
                <option value="pending">En attente</option>
            </select>

            {/* Currency */}
            <select
                className="input w-auto text-sm"
                value={filters.currency}
                onChange={(e) => onChange({ ...filters, currency: e.target.value })}
            >
                <option value="">Toutes les devises</option>
                <option value="XAF">XAF</option>
                <option value="XOF">XOF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
            </select>

            {/* LMS Item Filters */}
            <input
                className="input w-32 border-dashed border-primary/50 text-sm placeholder:text-primary/70 focus:border-primary"
                placeholder="ID Produit LMS"
                value={filters.lmsItemId}
                onChange={(e) => onChange({ ...filters, lmsItemId: e.target.value })}
            />
            <select
                className="input w-auto border-dashed border-primary/50 text-sm focus:border-primary"
                value={filters.lmsItemType}
                onChange={(e) => onChange({ ...filters, lmsItemType: e.target.value })}
            >
                <option value="">Type de Produit LMS</option>
                <option value="course">Formation</option>
                <option value="package">Package</option>
                <option value="subscription">Abonnement</option>
            </select>

            {/* Date range */}
            <input type="date" className="input w-auto text-sm"
                value={filters.from} onChange={(e) => onChange({ ...filters, from: e.target.value })} />
            <input type="date" className="input w-auto text-sm"
                value={filters.to} onChange={(e) => onChange({ ...filters, to: e.target.value })} />
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<Filters>({
        status: "", provider: "", currency: "", search: "", from: "", to: "", lmsItemId: "", lmsItemType: ""
    });

    const params = Object.fromEntries(
        Object.entries({ ...filters, page, limit: 25 }).filter(([, v]) => v !== "")
    ) as any;

    const { data, isLoading } = useQuery({
        queryKey: ["transactions", params],
        queryFn: () => adminApi.getTransactions(params).then((r) => r.data),
        placeholderData: (prev) => prev,
    });

    const transactions: Transaction[] = data?.data ?? [];
    const meta = data?.meta;

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-slide-up">
            <div>
                <h1 className="page-title">
                    Transaction <span className="gradient-text">Explorer</span>
                </h1>
                <p className="text-sm text-text-light mt-1">
                    {meta ? `${meta.total.toLocaleString()} transactions trouvées` : "Chargement…"}
                </p>
            </div>

            <FilterBar filters={filters} onChange={(f) => { setFilters(f); setPage(1); }} />

            <div className="card overflow-hidden">
                {isLoading ? (
                    <div className="p-6 space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Référence</th>
                                <th>Client</th>
                                <th>Montant</th>
                                <th>Provider</th>
                                <th>Statut</th>
                                <th>Date</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center text-text-light py-12">
                                        Aucune transaction trouvée
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((txn) => (
                                    <tr key={txn.id}>
                                        <td>
                                            <span className="font-mono text-xs bg-background px-2 py-1 rounded-lg">
                                                {txn.orderReference}
                                            </span>
                                        </td>
                                        <td className="text-xs text-text-light truncate max-w-[180px]">
                                            {txn.customerEmail}
                                        </td>
                                        <td className="font-semibold text-sm">
                                            {formatXAF(txn.amount)}
                                            <span className="text-xs text-text-light ml-1">{txn.currency}</span>
                                        </td>
                                        <td>
                                            {txn.provider ? (
                                                <span className="badge badge-primary text-xs">{txn.provider}</span>
                                            ) : (
                                                <span className="text-text-light text-xs">—</span>
                                            )}
                                        </td>
                                        <td><StatusBadge status={txn.status} /></td>
                                        <td className="text-xs text-text-light">
                                            {new Date(txn.createdAt).toLocaleString("fr-FR")}
                                        </td>
                                        <td>
                                            <Link
                                                href={txn.orderReference?.startsWith("ORD-") ? `/orders/${txn.orderId}` : `/transactions/${txn.orderReference}`}
                                                className="btn-ghost p-1.5 rounded-lg flex items-center justify-center"
                                                title="Voir le détail"
                                            >
                                                <ExternalLink size={13} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}

                {/* Pagination */}
                {meta && meta.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                        <p className="text-xs text-text-light">
                            Page {meta.page} sur {meta.totalPages} ({meta.total} résultats)
                        </p>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="btn-ghost p-1.5 rounded-lg disabled:opacity-30"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                                disabled={page === meta.totalPages}
                                className="btn-ghost p-1.5 rounded-lg disabled:opacity-30"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
