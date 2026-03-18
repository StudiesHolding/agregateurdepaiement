"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/lib/api";
import { formatXAF, cn } from "@/lib/utils";
import type { Order } from "@/lib/types";
import {
    ShoppingCart,
    CreditCard,
    CheckCircle,
    XCircle,
    Loader2,
    RefreshCw,
    Trash2,
    AlertCircle,
    ShieldCheck,
    Eye,
    Info,
    ChevronRight,
    Building2,
    Briefcase
} from "lucide-react";
import { toast } from "sonner";

// ── Components ────────────────────────────────────────────────────────────────

function OrderStatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        pending: "bg-amber-100 text-amber-700 border-amber-200",
        payment_confirmed: "bg-cyan-100 text-cyan-700 border-cyan-200",
        payment_failed: "bg-red-100 text-red-700 border-red-200",
        validated: "bg-emerald-100 text-emerald-700 border-emerald-200",
        completed: "bg-indigo-100 text-indigo-700 border-indigo-200",
        rejected: "bg-rose-100 text-rose-700 border-rose-200",
    };

    const labels: Record<string, string> = {
        pending: "En attente",
        payment_confirmed: "Paiement confirmé",
        payment_failed: "Paiement échoué",
        validated: "Validée",
        completed: "Provisionné",
        rejected: "Rejetée",
    };

    return (
        <span className={cn("px-2 py-1 rounded-full text-xs font-bold border", styles[status.toLowerCase()] ?? "bg-slate-100 text-slate-700 border-slate-200")}>
            {labels[status.toLowerCase()] ?? status}
        </span>
    );
}

function WorkflowTracker({ status }: { status: string }) {
    const steps = [
        { id: 'pending', label: 'Paiement', icon: CreditCard },
        { id: 'payment_confirmed', label: 'Confirmation', icon: ShieldCheck },
        { id: 'validated', label: 'Provisioning', icon: Building2 },
        { id: 'completed', label: 'Terminé', icon: CheckCircle },
    ];

    const currentStatus = status.toLowerCase();

    const getStepStatus = (stepId: string) => {
        const statusOrder = ['pending', 'payment_confirmed', 'validated', 'completed'];
        const currentIndex = statusOrder.indexOf(currentStatus === 'rejected' || currentStatus === 'payment_failed' ? 'pending' : currentStatus);
        const stepIndex = statusOrder.indexOf(stepId);

        if (stepIndex < currentIndex) return 'completed';
        if (stepIndex === currentIndex) return 'active';
        return 'upcoming';
    };

    return (
        <div className="flex items-center justify-between w-full max-w-2xl mx-auto py-10">
            {steps.map((step, index) => {
                const stepStatus = getStepStatus(step.id);
                const Icon = step.icon;

                return (
                    <div key={step.id} className="flex-1 flex items-center">
                        <div className="flex flex-col items-center relative group">
                            <div
                                className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg border-2",
                                    stepStatus === 'completed' && "bg-emerald-500 border-emerald-400 text-white scale-110",
                                    stepStatus === 'active' && "bg-primary border-primary/50 text-white scale-125 shadow-primary/30 animate-pulse",
                                    stepStatus === 'upcoming' && "bg-white border-slate-200 text-slate-400"
                                )}
                            >
                                <Icon size={24} />
                            </div>
                            <span className={cn("absolute -bottom-8 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap", stepStatus === 'active' ? "text-primary" : "text-slate-500")}>
                                {step.label}
                            </span>
                        </div>
                        {index < steps.length - 1 && (
                            <div className="flex-1 h-0.5 mx-4 bg-slate-100">
                                <div className={cn("h-full bg-primary transition-all", stepStatus === 'completed' ? "w-full" : "w-0")} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TestB2BPage() {
    const queryClient = useQueryClient();

    // Form state
    const [selectedPackage, setSelectedPackage] = useState<string>("");
    const [companyName, setCompanyName] = useState("Mon Entreprise SARL");
    const [companyIndustry, setCompanyIndustry] = useState("Technology");
    const [companyAdminEmail, setCompanyAdminEmail] = useState("admin@entreprise.com");
    const [customerPhone, setCustomerPhone] = useState("+237 600 000 000");
    const [customerCountry, setCustomerCountry] = useState("Cameroun");
    const [licenceCount, setLicenceCount] = useState<number>(1);

    // Created order
    const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

    // Fetch packages
    const { data: packagesData, isLoading: packagesLoading } = useQuery({
        queryKey: ["test-packages"],
        queryFn: async () => {
            const response = await adminApi.getTestPackages();
            return response.data as { success: boolean; data: any[] };
        },
    });

    const packages = packagesData?.data ?? [];

    // Mutations
    const createOrderMutation = useMutation({
        mutationFn: (data: any) => adminApi.createTestB2BOrder(data),
        onSuccess: (response) => {
            setCreatedOrder(response.data.data);
            toast.success("Commande B2B créée !");
            queryClient.invalidateQueries({ queryKey: ["orders"] });
        },
    });

    const simulatePaymentMutation = useMutation({
        mutationFn: (data: { status: string }) =>
            adminApi.simulateB2BPayment(createdOrder!.id, data.status),
        onSuccess: (response) => {
            setCreatedOrder({ ...createdOrder!, status: response.data.data.status });
            toast.success("Paiement simulé avec succès !");
            queryClient.invalidateQueries({ queryKey: ["orders"] });
        },
    });

    const provisionMutation = useMutation({
        mutationFn: () => adminApi.provisionB2BOrder(createdOrder!.id),
        onSuccess: (response) => {
            setCreatedOrder({ ...createdOrder!, status: response.data.data.status });
            toast.success("Provisioning B2B terminé ! Email avec facture envoyé.");
            queryClient.invalidateQueries({ queryKey: ["orders"] });
        },
        onError: (error: any) => {
            toast.error("Erreur: " + error.message);
        },
    });

    const resetOrderMutation = useMutation({
        mutationFn: () => adminApi.simulateB2BPayment(createdOrder!.id, "pending").then(() => createdOrder!.id),
        onSuccess: () => {
            setCreatedOrder({ ...createdOrder!, status: "pending" });
            toast.info("Commande réinitialisée");
        },
    });

    const deleteOrderMutation = useMutation({
        mutationFn: () => adminApi.deleteTestOrder(createdOrder!.id),
        onSuccess: () => {
            setCreatedOrder(null);
            toast.error("Commande supprimée");
            queryClient.invalidateQueries({ queryKey: ["orders"] });
        },
    });

    // Action Handlers
    const handleCreateOrder = (e: React.FormEvent) => {
        e.preventDefault();
        const selectedPkg = packages.find(p => p.id === selectedPackage);

        createOrderMutation.mutate({
            packageId: selectedPackage,
            packageName: selectedPkg?.name || "Pack Formation Entreprise",
            packagePrice: selectedPkg?.pricePerLicense,
            customerEmail: companyAdminEmail,
            customerName: companyName,
            companyName: companyName,
            companyIndustry: companyIndustry,
            companyAdminEmail: companyAdminEmail,
            customerPhone,
            customerCountry,
            licenceCount,
            unitPrice: selectedPkg?.pricePerLicense || 0,
        });
    };

    const handleReset = () => {
        setCreatedOrder(null);
        setSelectedPackage("");
    };

    const selectedPackageData = packages.find(p => p.id === selectedPackage);
    const totalAmount = licenceCount * (selectedPackageData?.pricePerLicense || 0);

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 lg:p-10 space-y-8">
            {/* Header */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur opacity-25" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                            <img src="https://new.studieslearning.com/Studies-learning/Back-Office-Formateurs/admin/assets/images/logosl.png" className="h-12 w-auto" alt="Studies Learning" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">B2B Control Room</h1>
                            <p className="text-slate-500 font-medium">Testeur de workflow Packages Entreprise</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {createdOrder && (
                            <button onClick={handleReset} className="btn btn-ghost">
                                <RefreshCw size={18} />
                                Nouvelle Session
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="xl:col-span-1 space-y-8">
                    <div className="card p-8 group">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold flex items-center gap-3">
                                <Briefcase className="text-primary" />
                                Configuration B2B
                            </h2>
                            {createdOrder && <OrderStatusBadge status={createdOrder.status} />}
                        </div>

                        <form onSubmit={handleCreateOrder} className="space-y-6">
                            {/* Package Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Package</label>
                                {packagesLoading ? (
                                    <div className="skeleton h-12 w-full rounded-xl" />
                                ) : (
                                    <select
                                        className="select select-bordered w-full bg-slate-50 border-slate-200 focus:border-primary rounded-xl"
                                        value={selectedPackage}
                                        onChange={(e) => {
                                            setSelectedPackage(e.target.value);
                                            const pkg = packages.find(p => p.id === e.target.value);
                                            if (pkg) {
                                                setLicenceCount(1);
                                            }
                                        }}
                                        required
                                        disabled={!!createdOrder}
                                    >
                                        <option value="">Choisir un package...</option>
                                        {packages.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} - {formatXAF(p.pricePerLicense)}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Licence Count */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">Nombre de Licences</label>
                                <input
                                    type="number"
                                    className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl"
                                    value={licenceCount}
                                    onChange={(e) => setLicenceCount(Number(e.target.value))}
                                    disabled={!!createdOrder}
                                    min={1}
                                />
                            </div>

                            {/* Total */}
                            {selectedPackage && (
                                <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-bold text-slate-700">Total à payer:</span>
                                        <span className="text-xl font-black text-primary">{formatXAF(totalAmount)}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {licenceCount} × {formatXAF(selectedPackageData?.pricePerLicense || 0)}
                                    </p>
                                </div>
                            )}

                            {/* Company Info */}
                            <div className="space-y-4">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Informations Entreprise</p>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Nom Entreprise</label>
                                    <input
                                        type="text"
                                        className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        disabled={!!createdOrder}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Secteur</label>
                                    <input
                                        type="text"
                                        className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl"
                                        value={companyIndustry}
                                        onChange={(e) => setCompanyIndustry(e.target.value)}
                                        disabled={!!createdOrder}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">Email Admin</label>
                                    <input
                                        type="email"
                                        className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl"
                                        value={companyAdminEmail}
                                        onChange={(e) => setCompanyAdminEmail(e.target.value)}
                                        disabled={!!createdOrder}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Téléphone</label>
                                        <input
                                            type="text"
                                            className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl"
                                            value={customerPhone}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                            disabled={!!createdOrder}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">Pays</label>
                                        <input
                                            type="text"
                                            className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl"
                                            value={customerCountry}
                                            onChange={(e) => setCustomerCountry(e.target.value)}
                                            disabled={!!createdOrder}
                                        />
                                    </div>
                                </div>
                            </div>

                            {!createdOrder && (
                                <button
                                    type="submit"
                                    className="btn btn-primary w-full shadow-lg shadow-primary/20 rounded-xl h-14"
                                    disabled={createOrderMutation.isPending || !selectedPackage}
                                >
                                    {createOrderMutation.isPending ? <Loader2 className="animate-spin" /> : <ShoppingCart size={20} />}
                                    Créer Commande B2B
                                </button>
                            )}
                        </form>
                    </div>

                    {createdOrder && (
                        <div className="card p-6 bg-slate-900 text-white">
                            <h3 className="font-black text-xs uppercase tracking-widest opacity-50 mb-4">Détails Techniques</h3>
                            <div className="space-y-3 font-mono text-[11px]">
                                <div className="flex justify-between border-b border-white/10 pb-2">
                                    <span className="opacity-50">ORDER_ID:</span>
                                    <span className="text-primary font-bold">{createdOrder.id}</span>
                                </div>
                                <div className="flex justify-between border-b border-white/10 pb-2">
                                    <span className="opacity-50">REFERENCE:</span>
                                    <span className="text-secondary font-bold">{createdOrder.reference}</span>
                                </div>
                                <div className="flex justify-between border-b border-white/10 pb-2">
                                    <span className="opacity-50">LICENCES:</span>
                                    <span className="text-cyan-400">{licenceCount}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => deleteOrderMutation.mutate()}
                                className="mt-6 btn btn-sm btn-ghost text-rose-400 hover:bg-rose-500/10 w-full"
                            >
                                <Trash2 size={14} /> Supprimer
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Column */}
                <div className="xl:col-span-2 space-y-8">
                    {/* Workflow */}
                    <div className="card p-8 overflow-hidden">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-xl font-bold flex items-center gap-3">
                                <Eye className="text-primary" />
                                Lifecycle B2B
                            </h2>
                            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black uppercase text-slate-500">Temps Réel</span>
                            </div>
                        </div>
                        <WorkflowTracker status={createdOrder?.status || 'pending'} />
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Simulation */}
                        <div className="card p-8 border-t-4 border-t-amber-500">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <RefreshCw size={18} className="text-amber-500" />
                                Simulation Paiement
                            </h3>

                            {!createdOrder ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-50">
                                    <AlertCircle size={40} className="mb-2" />
                                    <p className="text-sm font-medium">En attente de commande...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <p className="text-xs font-bold text-slate-500 mb-4 uppercase">Simuler Retour</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            <button
                                                onClick={() => simulatePaymentMutation.mutate({ status: "succeeded" })}
                                                disabled={simulatePaymentMutation.isPending || createdOrder.status !== 'pending'}
                                                className="btn btn-sm bg-white hover:bg-emerald-50 text-emerald-600 border-slate-200 shadow-sm justify-between"
                                            >
                                                <span className="flex items-center gap-2">CinetPay: Success</span>
                                                <ChevronRight size={14} />
                                            </button>
                                            <button
                                                onClick={() => simulatePaymentMutation.mutate({ status: "failed" })}
                                                disabled={simulatePaymentMutation.isPending || createdOrder.status !== 'pending'}
                                                className="btn btn-sm bg-white hover:bg-rose-50 text-rose-600 border-slate-200 shadow-sm justify-between"
                                            >
                                                <span className="flex items-center gap-2">CinetPay: Failure</span>
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => resetOrderMutation.mutate()}
                                        className="btn btn-sm btn-ghost text-indigo-600 w-full justify-start gap-2"
                                    >
                                        <RefreshCw size={14} />
                                        Réinitialiser
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Provisioning */}
                        <div className="card p-8 border-t-4 border-t-primary">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <ShieldCheck size={18} className="text-primary" />
                                Provisioning B2B
                            </h3>

                            {!createdOrder ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-50">
                                    <AlertCircle size={40} className="mb-2" />
                                    <p className="text-sm font-medium">Boutons désactivés</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase text-slate-400">Provisioning</span>
                                            {createdOrder.status === 'payment_confirmed' && <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />}
                                        </div>
                                        <button
                                            disabled={createdOrder.status !== 'payment_confirmed' || provisionMutation.isPending}
                                            onClick={() => provisionMutation.mutate()}
                                            className={cn(
                                                "w-full btn btn-sm rounded-xl h-14",
                                                createdOrder.status === 'payment_confirmed' ? "btn-success shadow-lg" : "btn-disabled bg-slate-100"
                                            )}
                                        >
                                            {provisionMutation.isPending ? <Loader2 className="animate-spin" /> : <Building2 size={16} />}
                                            Créer Entreprise & Envoyer Email
                                        </button>
                                        <p className="text-[10px] text-slate-500">
                                            Envoie email d'activation + facture PDF
                                        </p>
                                    </div>

                                    {createdOrder.status === 'validated' && (
                                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-start gap-3">
                                            <CheckCircle className="text-emerald-500 shrink-0" size={20} />
                                            <div className="text-xs text-emerald-800">
                                                <p className="font-bold">Provisioning terminé !</p>
                                                <p className="opacity-70 mt-1">Email avec facture envoyé.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-8 bg-blue-600 rounded-3xl text-white">
                        <h4 className="text-2xl font-black mb-2">Vérification Email</h4>
                        <p className="text-blue-100 font-medium mb-6">L'email d'activation avec la facture PDF sera envoyé à l'adresse de l'admin entreprise.</p>
                        <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 text-white rounded-2xl font-black border border-white/30">
                            <ShieldCheck size={16} /> Facture PDF Automatique
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
