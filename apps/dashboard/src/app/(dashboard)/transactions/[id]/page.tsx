"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { adminApi } from "@/lib/api";
import { formatXAF, cn } from "@/lib/utils";
import type { TransactionDetail, PaymentStatus } from "@/lib/types";
import {
    ArrowLeft,
    ChevronRight,
    Clock,
    CreditCard,
    User,
    ShoppingBag,
    History,
    Activity,
    AlertTriangle,
    CheckCircle2,
    FileCode,
} from "lucide-react";

// ── Status Chip ──────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: PaymentStatus | string }) {
    const styles: Record<string, string> = {
        succeeded: "bg-success-light text-success-dark border-success/20",
        failed: "bg-danger-light text-danger-dark border-danger/20",
        pending: "bg-warning-light text-warning-dark border-warning/20",
        processing: "bg-primary-light text-primary border-primary/20",
        refunded: "bg-border text-text-light border-border",
    };
    return (
        <span className={cn("px-3 py-1 rounded-full text-xs font-bold border", styles[status] ?? styles.pending)}>
            {status.toUpperCase()}
        </span>
    );
}

// ── Detail Section ───────────────────────────────────────────────────────────

function DetailSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
    return (
        <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-background/50 flex items-center gap-2">
                <Icon size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-text-main">{title}</h3>
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string | number | React.ReactNode; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
            <span className="text-xs font-medium text-text-light">{label}</span>
            <span className={cn("text-sm font-semibold text-text-main", mono && "font-mono text-xs bg-background px-1.5 py-0.5 rounded")}>
                {value}
            </span>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TransactionDetailPage() {
    const { id } = useParams();
    const router = useRouter();

    const { data, isLoading, error } = useQuery<TransactionDetail>({
        queryKey: ["transaction", id],
        queryFn: () => adminApi.getTransaction(id as string).then((r) => r.data.data),
        retry: 1,
    });

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="skeleton h-10 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="skeleton h-64 rounded-2xl" />
                    <div className="skeleton h-64 rounded-2xl" />
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="max-w-4xl mx-auto text-center py-20">
                <div className="w-16 h-16 bg-danger-light text-danger rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} />
                </div>
                <h1 className="text-xl font-bold text-text-main mb-2">Transaction Introuvable</h1>
                <p className="text-text-light mb-6">La référence {id} n&apos;existe pas ou vous n&apos;y avez pas accès.</p>
                <button onClick={() => router.back()} className="btn-primary">Retour à la liste</button>
            </div>
        );
    }

    const { intent, order, attempts } = data;

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
            {/* Breadcrumbs / Back */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.back()}
                    className="btn-ghost gap-2 -ml-2 text-text-light hover:text-text-main"
                >
                    <ArrowLeft size={16} />
                    Retour aux transactions
                </button>
                <div className="flex items-center gap-2 text-xs font-medium text-text-light">
                    <span>Transactions</span>
                    <ChevronRight size={12} />
                    <span className="text-text-main">{id}</span>
                </div>
            </div>

            {/* Header Info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-text-main flex items-center gap-3">
                        Transaction {intent.id}
                        <StatusChip status={intent.status} />
                    </h1>
                    <p className="text-sm text-text-light font-medium">
                        Créée le {new Date(intent.createdAt).toLocaleString("fr-FR")}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-3xl font-black text-primary">
                        {formatXAF(intent.amount)}
                        <span className="text-sm font-bold text-text-light ml-2">{intent.currency}</span>
                    </p>
                    <p className="text-xs font-bold text-success-dark bg-success-light px-2 py-0.5 rounded-lg inline-block mt-1">
                        Provider: {intent.selectedProvider}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Timeline / Attempts */}
                    <DetailSection title="Historique des Tentatives" icon={History}>
                        <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border before:to-transparent">
                            {attempts.map((attempt, i) => (
                                <div key={attempt.id} className="relative flex items-start gap-6 group">
                                    <div className={cn(
                                        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 bg-white",
                                        attempt.status === "succeeded" ? "border-success text-success" : "border-danger text-danger"
                                    )}>
                                        {attempt.status === "succeeded" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                                    </div>
                                    <div className="flex-1 bg-background rounded-2xl p-4 border border-border group-hover:border-primary/20 transition-all">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-bold text-text-main">Tentative #{i + 1} — {attempt.provider}</p>
                                            <span className="text-[10px] text-text-light">{new Date(attempt.createdAt).toLocaleTimeString()}</span>
                                        </div>
                                        <DetailRow label="ID Tentative" value={attempt.transactionNumber} mono />
                                        <DetailRow label="Statut" value={<span className={attempt.status === "succeeded" ? "text-success" : "text-danger"}>{attempt.status}</span>} />
                                        {attempt.errorCode && (
                                            <div className="mt-3 p-2.5 bg-danger-light rounded-xl border border-danger/10">
                                                <p className="text-[10px] font-bold text-danger-dark uppercase tracking-wider mb-1">Détail de l&apos;erreur</p>
                                                <p className="text-xs font-mono text-danger-dark">{attempt.errorCode}: {attempt.errorMessage}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DetailSection>

                    {/* Metadata */}
                    <DetailSection title="Métadonnées de la Commande" icon={FileCode}>
                        <div className="bg-background rounded-2xl p-4 border border-border font-mono text-[11px] text-text-light overflow-x-auto">
                            <pre>{JSON.stringify(order.metadata || {}, null, 2)}</pre>
                        </div>
                    </DetailSection>
                </div>

                <div className="space-y-6">
                    {/* Order Info */}
                    <DetailSection title="Détails de la Commande" icon={ShoppingBag}>
                        <div className="space-y-1">
                            <DetailRow label="Référence Order" value={order.reference} mono />
                            <DetailRow label="Montant Total" value={formatXAF(order.totalAmount)} />
                            <DetailRow label="ID Interne" value={`#${order.id}`} />
                        </div>
                    </DetailSection>

                    {/* Customer Info */}
                    <DetailSection title="Informations Client" icon={User}>
                        <div className="space-y-1">
                            <DetailRow label="Email" value={order.customerEmail} />
                            <DetailRow label="Identité" value="Client Studies Learning" />
                        </div>
                    </DetailSection>

                    {/* Technical Details */}
                    <DetailSection title="Infos Techniques" icon={Activity}>
                        <div className="space-y-1">
                            <DetailRow label="Idempotency Key" value={intent.idempotencyKey.slice(0, 15) + '...'} mono />
                            <DetailRow label="Gateway ID" value={intent.id} mono />
                            <div className="mt-4 p-3 bg-primary-light/30 rounded-xl border border-primary/10">
                                <p className="text-[10px] text-primary-dark font-bold flex items-center gap-1">
                                    <Clock size={10} /> Latence totale
                                </p>
                                <p className="text-sm font-bold text-text-main">
                                    {attempts.length > 0
                                        ? `${Math.round((new Date(attempts[attempts.length - 1].createdAt).getTime() - new Date(intent.createdAt).getTime()) / 1000)} secondes`
                                        : "—"}
                                </p>
                            </div>
                        </div>
                    </DetailSection>
                </div>
            </div>
        </div>
    );
}
