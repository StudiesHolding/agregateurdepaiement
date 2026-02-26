"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/lib/api";
import { formatXAF, cn } from "@/lib/utils";
import type { Formation, Order } from "@/lib/types";
import {
  ShoppingCart,
  CreditCard,
  CheckCircle,
  XCircle,
  Send,
  Loader2,
  RefreshCw,
  Trash2,
  Package,
  User,
  Mail,
  Phone,
  Gift,
  AlertCircle,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Eye,
  Info,
  ChevronRight,
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";

// ── Components ────────────────────────────────────────────────────────────────

function OrderStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    processing: "bg-blue-100 text-blue-700 border-blue-200",
    payment_confirmed: "bg-cyan-100 text-cyan-700 border-cyan-200",
    payment_failed: "bg-red-100 text-red-700 border-red-200",
    validated: "bg-emerald-100 text-emerald-700 border-emerald-200",
    completed: "bg-indigo-100 text-indigo-700 border-indigo-200",
    rejected: "bg-rose-100 text-rose-700 border-rose-200",
  };

  const labels: Record<string, string> = {
    pending: "En attente",
    processing: "En traitement",
    payment_confirmed: "Paiement confirmé",
    payment_failed: "Paiement échoué",
    validated: "Validée",
    completed: "Terminée",
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
    { id: 'validated', label: 'Validation', icon: ClipboardList },
    { id: 'completed', label: 'Finalisation', icon: CheckCircle },
  ];

  const currentStatus = status.toLowerCase();

  const getStepStatus = (stepId: string) => {
    const statusOrder = ['pending', 'payment_confirmed', 'validated', 'completed'];
    const currentIndex = statusOrder.indexOf(currentStatus === 'rejected' || currentStatus === 'payment_failed' ? 'pending' : currentStatus);
    const stepIndex = statusOrder.indexOf(stepId);

    if (currentStatus === 'rejected' && stepId === 'validated') return 'error';
    if (currentStatus === 'payment_failed' && stepId === 'pending') return 'error';
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
                  stepStatus === 'upcoming' && "bg-white border-slate-200 text-slate-400",
                  stepStatus === 'error' && "bg-rose-500 border-rose-400 text-white"
                )}
              >
                <Icon size={24} />
              </div>
              <span
                className={cn(
                  "absolute -bottom-8 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors",
                  stepStatus === 'active' ? "text-primary" : "text-slate-500"
                )}
              >
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 mx-4 bg-slate-100 relative overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-0 bg-primary transition-all duration-1000",
                    stepStatus === 'completed' ? "translate-x-0" : "-translate-x-full"
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TestOrderPage() {
  const queryClient = useQueryClient();

  // Form state
  const [selectedFormation, setSelectedFormation] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState("test@example.com");
  const [customerName, setCustomerName] = useState("Test User");
  const [customerPhone, setCustomerPhone] = useState("+237 600 000 000");
  const [purchaseType, setPurchaseType] = useState<"self" | "gift">("self");
  const [amount, setAmount] = useState<number>(5000);

  // Beneficiary for gifts
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryEmail, setBeneficiaryEmail] = useState("");

  // Created order
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // Fetch formations
  const { data: formationsData, isLoading: formationsLoading } = useQuery({
    queryKey: ["test-formations"],
    queryFn: async () => {
      const response = await adminApi.getTestFormations();
      return response.data as { success: boolean; data: Formation[] };
    },
  });

  const formations = formationsData?.data ?? [];

  // Mutations
  const createOrderMutation = useMutation({
    mutationFn: (data: any) => adminApi.createTestOrder(data),
    onSuccess: (response) => {
      setCreatedOrder(response.data.data);
      toast.success("Commande créée !");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const simulateWebhookMutation = useMutation({
    mutationFn: (data: { provider: string; status: string }) =>
      adminApi.simulateWebhook({ orderId: createdOrder!.id, ...data }),
    onSuccess: (response) => {
      setCreatedOrder({ ...createdOrder!, status: response.data.data.orderStatus });
      toast.success(response.data.message);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", createdOrder!.id] });
    },
  });

  const validateOrderMutation = useMutation({
    mutationFn: (action: "validate" | "reject") =>
      adminApi.validateOrder(createdOrder!.id, { action }),
    onSuccess: (response, action) => {
      setCreatedOrder(response.data.data.order);
      toast.success(`Commande ${action === 'validate' ? 'validée' : 'rejetée'}`);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const completeOrderMutation = useMutation({
    mutationFn: () =>
      adminApi.completeOrder(createdOrder!.id, {
        username: `user_${createdOrder!.reference.split('-')[1]}`,
        password: "password123",
      }),
    onSuccess: (response) => {
      setCreatedOrder(response.data.data.order);
      toast.success("Commande finalisée, identifiants envoyés !");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const resetOrderMutation = useMutation({
    mutationFn: () => adminApi.resetOrder(createdOrder!.id),
    onSuccess: (response) => {
      setCreatedOrder(response.data.data);
      toast.info("Workflow réinitialisé");
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
    const formation = formations.find(f => f.id === selectedFormation);
    createOrderMutation.mutate({
      formationId: selectedFormation,
      formationName: formation?.title,
      formationPrice: amount,
      customerEmail,
      customerName,
      customerPhone,
      purchaseType,
      amount,
      beneficiaryEmail: purchaseType === 'gift' ? beneficiaryEmail : undefined,
      beneficiaryFirstName: purchaseType === 'gift' ? beneficiaryName : undefined
    });
  };

  const handleReset = () => {
    setCreatedOrder(null);
    setSelectedFormation("");
  };

  const selectedFormationData = formations.find(f => f.id === selectedFormation);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 lg:p-10 space-y-8">
      {/* Header with Glass Effect */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur opacity-25" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <Terminal size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Workflow Control Room</h1>
              <p className="text-slate-500 font-medium">Testeur de cycle de vie et de webhooks LMS</p>
            </div>
          </div>

          <div className="flex gap-2">
            {createdOrder && (
              <button
                onClick={handleReset}
                className="btn btn-ghost"
              >
                <RefreshCw size={18} />
                Nouvelle Session
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

        {/* Left Column: Command Center / Form */}
        <div className="xl:col-span-1 space-y-8">
          <div className="card p-8 group">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <ShoppingCart className="text-primary" />
                Configuration
              </h2>
              {createdOrder && <OrderStatusBadge status={createdOrder.status} />}
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Formation</label>
                <select
                  className="select select-bordered w-full bg-slate-50 border-slate-200 focus:border-primary rounded-xl"
                  value={selectedFormation}
                  onChange={(e) => setSelectedFormation(e.target.value)}
                  required
                  disabled={!!createdOrder}
                >
                  <option value="">Choisir une formation...</option>
                  {formations.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title} ({formatXAF(f.price)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Type</label>
                  <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", purchaseType === 'self' ? "bg-white shadow-sm text-primary" : "text-slate-500")}
                      onClick={() => setPurchaseType('self')}
                      disabled={!!createdOrder}
                    >
                      Personnel
                    </button>
                    <button
                      type="button"
                      className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", purchaseType === 'gift' ? "bg-white shadow-sm text-secondary" : "text-slate-500")}
                      onClick={() => setPurchaseType('gift')}
                      disabled={!!createdOrder}
                    >
                      Cadeau
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Montant</label>
                  <input
                    type="number"
                    className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    disabled={!!createdOrder}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Client Email</label>
                  <input
                    type="email"
                    className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    disabled={!!createdOrder}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Client Nom</label>
                  <input
                    type="text"
                    className="input input-bordered w-full bg-slate-50 border-slate-200 rounded-xl"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    disabled={!!createdOrder}
                  />
                </div>
              </div>

              {purchaseType === 'gift' && (
                <div className="p-4 bg-secondary/5 border border-secondary/10 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
                  <p className="text-xs font-black text-secondary uppercase tracking-widest">Destinataire Cadeau</p>
                  <input
                    type="email"
                    placeholder="Email bénéficiaire"
                    className="input input-sm input-bordered w-full rounded-lg"
                    value={beneficiaryEmail}
                    onChange={(e) => setBeneficiaryEmail(e.target.value)}
                    disabled={!!createdOrder}
                  />
                  <input
                    type="text"
                    placeholder="Nom bénéficiaire"
                    className="input input-sm input-bordered w-full rounded-lg"
                    value={beneficiaryName}
                    onChange={(e) => setBeneficiaryName(e.target.value)}
                    disabled={!!createdOrder}
                  />
                </div>
              )}

              {!createdOrder && (
                <button
                  type="submit"
                  className="btn btn-primary w-full shadow-lg shadow-primary/20 rounded-xl h-14"
                  disabled={createOrderMutation.isPending || !selectedFormation}
                >
                  {createOrderMutation.isPending ? <Loader2 className="animate-spin" /> : <ShoppingCart size={20} />}
                  Initier la commande
                </button>
              )}
            </form>
          </div>

          {createdOrder && (
            <div className="card p-6 bg-slate-900 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Info size={80} />
              </div>
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
                  <span className="opacity-50">PROVIDER_KEY:</span>
                  <span className="text-cyan-400">TEST_MODE_ENABLED</span>
                </div>
              </div>
              <button
                onClick={() => deleteOrderMutation.mutate()}
                className="mt-6 btn btn-sm btn-ghost text-rose-400 hover:bg-rose-500/10 w-full"
              >
                <Trash2 size={14} /> Supprimer l'entrée
              </button>
            </div>
          )}
        </div>

        {/* Right Columns: Simulation Console */}
        <div className="xl:col-span-2 space-y-8">
          {/* Workflow Visualization */}
          <div className="card p-8 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <Eye className="text-primary" />
                Visualisation du Lifecycle
              </h2>
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">Flux Temps Réel</span>
              </div>
            </div>
            <WorkflowTracker status={createdOrder?.status || 'pending'} />
          </div>

          {/* Webhook & Actions Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Simulation Pane */}
            <div className="card p-8 border-t-4 border-t-amber-500">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <RefreshCw size={18} className="text-amber-500" />
                Webhook Simulator
              </h3>

              {!createdOrder ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-50">
                  <AlertCircle size={40} className="mb-2" />
                  <p className="text-sm font-medium">En attente de commande...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-500 mb-4 uppercase">Simuler Retour Agrégateur</p>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => simulateWebhookMutation.mutate({ provider: "cinetpay", status: "success" })}
                        disabled={simulateWebhookMutation.isPending || createdOrder.status !== 'pending'}
                        className="btn btn-sm bg-white hover:bg-emerald-50 text-emerald-600 border-slate-200 shadow-sm justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <img src="https://cinetpay.com/favicon.png" className="w-4 h-4 rounded grayscale group-hover:grayscale-0" alt="" />
                          CinetPay: Success
                        </div>
                        <ChevronRight size={14} />
                      </button>
                      <button
                        onClick={() => simulateWebhookMutation.mutate({ provider: "stripe", status: "success" })}
                        disabled={simulateWebhookMutation.isPending || createdOrder.status !== 'pending'}
                        className="btn btn-sm bg-white hover:bg-emerald-50 text-emerald-600 border-slate-200 shadow-sm justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard size={14} />
                          Stripe: Success
                        </div>
                        <ChevronRight size={14} />
                      </button>
                      <button
                        onClick={() => simulateWebhookMutation.mutate({ provider: "cinetpay", status: "error" })}
                        disabled={simulateWebhookMutation.isPending || createdOrder.status !== 'pending'}
                        className="btn btn-sm bg-white hover:bg-rose-50 text-rose-600 border-slate-200 shadow-sm justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <XCircle size={14} />
                          CinetPay: Failure
                        </div>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-500 mb-2 uppercase">Utils</p>
                    <button
                      onClick={() => resetOrderMutation.mutate()}
                      className="btn btn-sm btn-ghost text-indigo-600 w-full justify-start gap-2"
                    >
                      <RefreshCw size={14} />
                      Réinitialiser à PENDING
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Actions Pane */}
            <div className="card p-8 border-t-4 border-t-primary">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary" />
                Interactions Admin
              </h3>

              {!createdOrder ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-50">
                  <AlertCircle size={40} className="mb-2" />
                  <p className="text-sm font-medium">Boutons d'action désactivés</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Validation Block */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Phase 3: Validation Professionnelle</span>
                      {createdOrder.status === 'payment_confirmed' && <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />}
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={createdOrder.status !== 'payment_confirmed' || validateOrderMutation.isPending}
                        onClick={() => validateOrderMutation.mutate("validate")}
                        className={cn(
                          "flex-1 btn btn-sm rounded-xl h-12",
                          createdOrder.status === 'payment_confirmed' ? "btn-success" : "btn-disabled bg-slate-100"
                        )}
                      >
                        {validateOrderMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle size={16} />}
                        Valider
                      </button>
                      <button
                        disabled={createdOrder.status !== 'payment_confirmed' || validateOrderMutation.isPending}
                        onClick={() => validateOrderMutation.mutate("reject")}
                        className={cn(
                          "flex-1 btn btn-sm rounded-xl h-12",
                          createdOrder.status === 'payment_confirmed' ? "btn-error" : "btn-disabled bg-slate-100"
                        )}
                      >
                        Rejeter
                      </button>
                    </div>
                  </div>

                  {/* Finalization Block */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">Phase 4: Inscription Campus</span>
                    <button
                      disabled={createdOrder.status !== 'validated' || completeOrderMutation.isPending}
                      onClick={() => completeOrderMutation.mutate()}
                      className={cn(
                        "w-full btn btn-sm rounded-xl h-12",
                        createdOrder.status === 'validated' ? "btn-primary shadow-lg shadow-primary/20" : "btn-disabled bg-slate-100"
                      )}
                    >
                      {completeOrderMutation.isPending ? <Loader2 className="animate-spin" /> : <Send size={16} />}
                      Envoyer Accès Campus
                    </button>
                  </div>

                  {/* Feedbacks */}
                  {createdOrder.status === 'completed' && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-start gap-3">
                      <CheckCircle className="text-emerald-500 shrink-0" size={20} />
                      <div className="text-xs text-emerald-800">
                        <p className="font-bold">Workflow terminé avec succès !</p>
                        <p className="opacity-70 mt-1">L'étudiant a reçu ses accès et sa facture.</p>
                      </div>
                    </div>
                  )}

                  {createdOrder.status === 'rejected' && (
                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex items-start gap-3">
                      <XCircle className="text-rose-500 shrink-0" size={20} />
                      <div className="text-xs text-rose-800">
                        <p className="font-bold">Commande Rejetée</p>
                        <p className="opacity-70 mt-1">Le client a été notifié de l'annulation.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-8 bg-blue-600 rounded-3xl text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <Mail size={120} />
            </div>
            <div className="relative z-10 max-w-md">
              <h4 className="text-2xl font-black mb-2">Vérification de l'Email Professionnel</h4>
              <p className="text-blue-100 font-medium mb-6">Le système est configuré sur IONOS (smtp.ionos.fr). Utilisez une adresse email réelle dans le formulaire ci-dessus pour recevoir les templates et factures en direct.</p>
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 backdrop-blur-md text-white rounded-2xl font-black border border-white/30">
                <ShieldCheck size={16} /> SMTP IONOS Actif
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
