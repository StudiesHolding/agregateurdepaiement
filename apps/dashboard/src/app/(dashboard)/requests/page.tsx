"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Search,
    Filter,
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    Eye,
    Users,
    Building2,
    RefreshCw,
    Check,
    X,
    Mail
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { adminApi } from "@/lib/api";

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
    pending: {
        icon: Clock,
        color: "text-amber-600",
        bg: "bg-amber-100",
        label: "En attente",
    },
    processing: {
        icon: Loader2,
        color: "text-blue-600",
        bg: "bg-blue-100",
        label: "En cours",
    },
    activated: {
        icon: CheckCircle2,
        color: "text-green-600",
        bg: "bg-green-100",
        label: "Activé",
    },
    rejected: {
        icon: XCircle,
        color: "text-red-600",
        bg: "bg-red-100",
        label: "Rejeté",
    },
};

export default function RequestsPage() {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<string>("all");
    const [selectedRequests, setSelectedRequests] = useState<number[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [credentials, setCredentials] = useState({ username: "", password: "" });

    // Fetch requests
    const { data, isLoading, refetch } = useQuery({
        queryKey: ["admin-requests", filter],
        queryFn: async () => {
            const params: Record<string, string | number> = {
                limit: 50,
            };
            if (filter !== "all") params.status = filter;
            const response = await adminApi.getRequests(params);
            return response.data.data;
        },
    });

    // Mutations
    const approveMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { username: string; password: string; admin_notes?: string } }) => adminApi.approveRequest(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
            setShowApproveModal(false);
            setSelectedRequests([]);
            setCredentials({ username: "", password: "" });
            alert("Demande approuvée avec succès !");
        },
        onError: (error: any) => {
            alert(error.message || "Erreur lors de l'approbation");
        },
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { reason?: string; admin_notes?: string } }) => adminApi.rejectRequest(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
            setShowRejectModal(false);
            setRejectReason("");
            setSelectedRequests([]);
            alert("Demande rejetée !");
        },
        onError: (error: any) => {
            alert(error.message || "Erreur lors du rejet");
        },
    });

    const batchApproveMutation = useMutation({
        mutationFn: (data: { request_ids: number[]; credentials: { username: string; password: string }; admin_notes?: string }) => adminApi.batchApproveRequests(data),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
            setShowApproveModal(false);
            setSelectedRequests([]);
            setCredentials({ username: "", password: "" });
            alert(res.data.message || "Demandes approuvées avec succès !");
        },
        onError: (error: any) => {
            alert(error.message || "Erreur lors de l'approbation");
        },
    });

    const requests = data || [];

    const filteredRequests = filter === "all"
        ? requests
        : requests.filter((r: any) => r.status === filter);

    const counts = {
        all: requests.length,
        pending: requests.filter((r: any) => r.status === "pending").length,
        processing: requests.filter((r: any) => r.status === "processing").length,
        activated: requests.filter((r: any) => r.status === "activated").length,
        rejected: requests.filter((r: any) => r.status === "rejected").length,
    };

    const handleSelectAll = () => {
        if (selectedRequests.length === filteredRequests.length) {
            setSelectedRequests([]);
        } else {
            setSelectedRequests(filteredRequests.map((r: any) => r.id));
        }
    };

    const handleSelectRequest = (id: number) => {
        if (selectedRequests.includes(id)) {
            setSelectedRequests(selectedRequests.filter((i) => i !== id));
        } else {
            setSelectedRequests([...selectedRequests, id]);
        }
    };

    const handleApprove = () => {
        if (selectedRequests.length === 1) {
            approveMutation.mutate({ id: selectedRequests[0], data: credentials });
        } else {
            batchApproveMutation.mutate({
                request_ids: selectedRequests,
                credentials,
            });
        }
    };

    const handleReject = () => {
        if (selectedRequests.length === 1) {
            rejectMutation.mutate({ id: selectedRequests[0], data: { reason: rejectReason } });
        } else {
            adminApi.batchRejectRequests({ request_ids: selectedRequests, reason: rejectReason })
                .then((res) => {
                    queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
                    setShowRejectModal(false);
                    setRejectReason("");
                    setSelectedRequests([]);
                    alert(res.data.message || "Demandes rejetées !");
                })
                .catch((error: any) => {
                    alert(error.message || "Erreur lors du rejet");
                });
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-[60vh] w-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-main tracking-tight">
                        Demandes d'Accès B2B
                    </h1>
                    <p className="mt-1 text-sm text-text-light">
                        Gérer les demandes d'accès aux formations des entreprises
                    </p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="p-2 rounded-xl bg-surface hover:bg-background transition-colors"
                >
                    <RefreshCw className="h-5 w-5 text-text-light" />
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {(["all", "pending", "processing", "activated", "rejected"] as const).map((status) => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={cn(
                            "p-4 rounded-2xl border transition-all text-left",
                            filter === status
                                ? "bg-primary text-white border-primary shadow-glow"
                                : "bg-surface border-white/5 hover:border-primary/20"
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <span className={cn(
                                "text-xs font-bold uppercase tracking-wider",
                                filter === status ? "text-white/80" : "text-text-muted"
                            )}>
                                {status === "all" ? "Total" : statusConfig[status]?.label}
                            </span>
                            <span className={cn(
                                "text-2xl font-black",
                                filter === status ? "text-white" : "text-text-main"
                            )}>
                                {counts[status]}
                            </span>
                        </div>
                    </button>
                ))}
            </div>

            {/* Bulk Actions */}
            {selectedRequests.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-sm font-medium text-text-main">
                        {selectedRequests.length} demande(s) sélectionnée(s)
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowApproveModal(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Approuver
                        </button>
                        <button
                            onClick={() => setShowRejectModal(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                        >
                            <XCircle className="h-4 w-4" />
                            Rejeter
                        </button>
                        <button
                            onClick={() => setSelectedRequests([])}
                            className="px-4 py-2 rounded-xl bg-surface text-text-light font-medium hover:bg-background transition-colors"
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            )}

            {/* Request Table */}
            <div className="card p-0 overflow-hidden border-white/5 shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5 bg-background/30 backdrop-blur-sm">
                                <th className="py-4 px-4 w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedRequests.length === filteredRequests.length && filteredRequests.length > 0}
                                        onChange={handleSelectAll}
                                        className="rounded border-gray-300"
                                    />
                                </th>
                                <th className="py-4 px-4 text-left text-[10px] font-black text-text-muted uppercase tracking-[0.1em]">
                                    Employé
                                </th>
                                <th className="py-4 px-4 text-left text-[10px] font-black text-text-muted uppercase tracking-[0.1em]">
                                    Entreprise
                                </th>
                                <th className="py-4 px-4 text-left text-[10px] font-black text-text-muted uppercase tracking-[0.1em]">
                                    Package
                                </th>
                                <th className="py-4 px-4 text-left text-[10px] font-black text-text-muted uppercase tracking-[0.1em]">
                                    Statut
                                </th>
                                <th className="py-4 px-4 text-left text-[10px] font-black text-text-muted uppercase tracking-[0.1em]">
                                    Date
                                </th>
                                <th className="py-4 px-4 text-left text-[10px] font-black text-text-muted uppercase tracking-[0.1em]">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredRequests.map((req: any, index: number) => {
                                const sc = statusConfig[req.status] || statusConfig.pending;
                                const StatusIcon = sc.icon;

                                return (
                                    <tr
                                        key={req.id}
                                        className={cn(
                                            "group hover:bg-white/[0.02] transition-colors animate-slide-up",
                                            selectedRequests.includes(req.id) && "bg-primary/5"
                                        )}
                                        style={{ animationDelay: `${index * 30}ms` }}
                                    >
                                        <td className="py-4 px-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedRequests.includes(req.id)}
                                                onChange={() => handleSelectRequest(req.id)}
                                                className="rounded border-gray-300"
                                                disabled={req.status === "activated" || req.status === "rejected"}
                                            />
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/10">
                                                    {req.employee?.first_name?.charAt(0)}{req.employee?.last_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-text-main text-xs">
                                                        {req.employee?.first_name} {req.employee?.last_name}
                                                    </p>
                                                    <p className="text-text-muted text-[10px]">{req.employee?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-text-muted" />
                                                <span className="font-medium text-text-main text-xs">
                                                    {req.company?.name || "Entreprise"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-text-light text-xs">
                                            {req.companyPackage?.package?.title || "Package"}
                                        </td>
                                        <td className="py-4 px-4">
                                            <span
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm",
                                                    sc.bg,
                                                    sc.color
                                                )}
                                            >
                                                <StatusIcon
                                                    className={cn(
                                                        "h-3 w-3",
                                                        req.status === "processing" && "animate-spin"
                                                    )}
                                                />
                                                {sc.label}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-text-muted text-xs font-medium">
                                            {formatDate(req.created_at)}
                                        </td>
                                        <td className="py-4 px-4">
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setSelectedRequest(req)}
                                                    className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                                    title="Voir les détails"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                {(req.status === "pending" || req.status === "processing") && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedRequests([req.id]);
                                                                setShowApproveModal(true);
                                                            }}
                                                            className="p-2 rounded-xl bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                                                            title="Approuver"
                                                        >
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedRequests([req.id]);
                                                                setShowRejectModal(true);
                                                            }}
                                                            className="p-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                                            title="Rejeter"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredRequests.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 glass-dark">
                        <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-6 shadow-glow-sm">
                            <Users className="h-10 w-10 opacity-50" />
                        </div>
                        <h3 className="text-lg font-bold text-text-main">Aucune demande trouvée</h3>
                        <p className="text-sm text-text-light mt-1">
                            {filter !== "all" ? "Essayez un autre filtre" : "Aucune demande d'accès pour le moment"}
                        </p>
                    </div>
                )}
            </div>

            {/* Approve Modal */}
            {showApproveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-text-main mb-4">
                            Approuver {selectedRequests.length > 1 ? `${selectedRequests.length} demandes` : "la demande"}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-main mb-2">
                                    Nom d'utilisateur LMS *
                                </label>
                                <input
                                    type="text"
                                    value={credentials.username}
                                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                                    className="input w-full"
                                    placeholder="identifiant@entreprise.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-main mb-2">
                                    Mot de passe LMS *
                                </label>
                                <input
                                    type="password"
                                    value={credentials.password}
                                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                                    className="input w-full"
                                    placeholder="••••••••"
                                />
                            </div>

                            <p className="text-sm text-text-light">
                                Les identifiants seront envoyés à l'employé par email.
                            </p>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowApproveModal(false);
                                    setCredentials({ username: "", password: "" });
                                }}
                                className="btn btn-secondary flex-1"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={!credentials.username || !credentials.password || approveMutation.isPending}
                                className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                            >
                                {approveMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        Approuver
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-surface rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-text-main mb-4">
                            Rejeter {selectedRequests.length > 1 ? `${selectedRequests.length} demandes` : "la demande"}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-main mb-2">
                                    Motif du rejet (optionnel)
                                </label>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    className="input w-full h-24"
                                    placeholder="Raison du rejet..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectReason("");
                                }}
                                className="btn btn-secondary flex-1"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={rejectMutation.isPending}
                                className="btn btn-danger flex-1 flex items-center justify-center gap-2"
                            >
                                {rejectMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <XCircle className="h-4 w-4" />
                                        Rejeter
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-surface rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-text-main">Détails de la demande</h2>
                            <button
                                onClick={() => setSelectedRequest(null)}
                                className="p-2 rounded-xl hover:bg-background transition-colors"
                            >
                                <XCircle className="h-5 w-5 text-text-muted" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Status */}
                            <div className="flex items-center justify-between p-4 bg-background rounded-xl">
                                <span className="text-sm text-text-muted">Statut</span>
                                {(() => {
                                    const sc = statusConfig[selectedRequest.status] || statusConfig.pending;
                                    const StatusIcon = sc.icon;
                                    return (
                                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase", sc.bg, sc.color)}>
                                            <StatusIcon className="h-3 w-3" />
                                            {sc.label}
                                        </span>
                                    );
                                })()}
                            </div>

                            {/* Employee Info */}
                            <div className="p-4 bg-background rounded-xl">
                                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Employé</h4>
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary">
                                        {selectedRequest.employee?.first_name?.charAt(0)}{selectedRequest.employee?.last_name?.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-text-main">
                                            {selectedRequest.employee?.first_name} {selectedRequest.employee?.last_name}
                                        </p>
                                        <p className="text-sm text-text-muted">{selectedRequest.employee?.email}</p>
                                    </div>
                                </div>
                                {selectedRequest.employee?.department && (
                                    <p className="text-sm text-text-muted mt-2">
                                        Département: <span className="text-text-main">{selectedRequest.employee.department}</span>
                                    </p>
                                )}
                            </div>

                            {/* Company Info */}
                            <div className="p-4 bg-background rounded-xl">
                                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Entreprise</h4>
                                <div className="flex items-center gap-3">
                                    <Building2 className="h-8 w-8 text-text-muted" />
                                    <div>
                                        <p className="font-bold text-text-main">{selectedRequest.company?.name || "Entreprise"}</p>
                                        <p className="text-sm text-text-muted">{selectedRequest.company?.email}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Package Info */}
                            <div className="p-4 bg-background rounded-xl">
                                <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Package</h4>
                                <p className="font-bold text-text-main">
                                    {selectedRequest.companyPackage?.package?.title || "Package"}
                                </p>
                                <p className="text-sm text-text-muted mt-1">
                                    Licences: {selectedRequest.companyPackage?.used_licenses || 0} / {selectedRequest.companyPackage?.total_licenses || 0}
                                </p>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-background rounded-xl">
                                    <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Créé le</h4>
                                    <p className="font-semibold text-text-main text-sm">
                                        {formatDate(selectedRequest.created_at)}
                                    </p>
                                </div>
                                {selectedRequest.processed_at && (
                                    <div className="p-4 bg-background rounded-xl">
                                        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Traité le</h4>
                                        <p className="font-semibold text-text-main text-sm">
                                            {formatDate(selectedRequest.processed_at)}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Notes */}
                            {selectedRequest.admin_notes && (
                                <div className="p-4 bg-warning/10 rounded-xl border border-warning/20">
                                    <h4 className="text-xs font-bold text-warning-dark uppercase tracking-wider mb-2">Notes</h4>
                                    <p className="text-sm text-text-main">{selectedRequest.admin_notes}</p>
                                </div>
                            )}

                            {/* Rejection Reason */}
                            {selectedRequest.rejection_reason && (
                                <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                                    <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Motif du rejet</h4>
                                    <p className="text-sm text-text-main">{selectedRequest.rejection_reason}</p>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        {(selectedRequest.status === "pending" || selectedRequest.status === "processing") && (
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setSelectedRequests([selectedRequest.id]);
                                        setShowApproveModal(true);
                                        setSelectedRequest(null);
                                    }}
                                    className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Approuver
                                </button>
                                <button
                                    onClick={() => {
                                        setSelectedRequests([selectedRequest.id]);
                                        setShowRejectModal(true);
                                        setSelectedRequest(null);
                                    }}
                                    className="btn btn-danger flex-1 flex items-center justify-center gap-2"
                                >
                                    <XCircle className="h-4 w-4" />
                                    Rejeter
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => setSelectedRequest(null)}
                            className="btn btn-secondary w-full mt-3"
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
