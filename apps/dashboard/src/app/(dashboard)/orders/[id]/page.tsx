"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { adminApi } from "@/lib/api";
import { formatXAF, cn } from "@/lib/utils";
import type { Order, OrderStatus, OrderAuditLog } from "@/lib/types";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Gift,
  User,
  Mail,
  Phone,
  MapPin,
  History,
  Send,
  Loader2,
  AlertCircle,
  CreditCard,
  RefreshCcw,
  Calendar,
  Activity,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

// ── Status Badge ────────────────────────────────────────────────────────────────

function OrderStatusBadge({ status }: { status: OrderStatus | string }) {
  const statusLower = (status as string).toLowerCase();

  const styles: Record<string, string> = {
    pending: "bg-warning-light text-warning-dark border-warning/20",
    processing: "bg-primary-light text-primary-dark border-primary/20",
    payment_failed: "bg-danger-light text-danger-dark border-danger/20",
    payment_confirmed: "bg-info-light text-info-dark border-info/20",
    validated: "bg-success-light text-success-dark border-success/20",
    completed: "bg-success-light text-success-dark border-success/20",
    rejected: "bg-danger-light text-danger-dark border-danger/20",
    cancelled: "bg-border text-text-light border-border/20",
    expired: "bg-border text-text-light border-border/20",
    refunded: "bg-border text-text-light border-border/20",
  };

  const labels: Record<string, string> = {
    pending: "En attente",
    processing: "Traitement",
    payment_failed: "Échec",
    payment_confirmed: "Confirmé",
    validated: "Validée",
    completed: "Terminée",
    rejected: "Rejetée",
    cancelled: "Annulée",
    expired: "Expirée",
    refunded: "Remboursée",
  };

  return (
    <span className={cn(
      "px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider leading-none",
      styles[statusLower] ?? "bg-border text-text-light border-border"
    )}>
      {labels[statusLower] ?? status}
    </span>
  );
}

// ── Workflow Tracker ─────────────────────────────────────────────────────────────

function WorkflowTracker({ status }: { status: string }) {
  const steps = [
    { id: 'payment', label: 'Paiement', states: ['pending', 'processing', 'payment_failed'] },
    { id: 'confirmed', label: 'Confirmation', states: ['payment_confirmed'] },
    { id: 'validation', label: 'Validation', states: ['validated'] },
    { id: 'completion', label: 'Finalisation', states: ['completed'] }
  ];

  const currentIdx = steps.findIndex(s => s.states.includes(status.toLowerCase()));
  const finalIdx = status.toLowerCase() === 'rejected' ? -1 : currentIdx === -1 ? 3 : currentIdx;

  return (
    <div className="card p-6 bg-background/30 mb-8">
      <div className="flex items-center justify-between gap-4 max-w-3xl mx-auto">
        {steps.map((step, idx) => {
          const isDone = idx < finalIdx;
          const isCurrent = idx === finalIdx;

          return (
            <div key={step.id} className="flex-1 flex flex-col items-center gap-2 relative">
              <div className={cn(
                "z-10 w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-300 shadow-sm",
                isDone ? "bg-success border-success text-white" :
                  isCurrent ? "bg-primary border-primary text-white scale-110" :
                    "bg-surface border-border text-text-light"
              )}>
                {isDone ? <CheckCircle size={18} /> : isCurrent ? <Activity size={18} className="animate-pulse" /> : <span>{idx + 1}</span>}
              </div>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                isCurrent ? "text-primary" : isDone ? "text-success" : "text-text-light"
              )}>
                {step.label}
              </span>
              {idx < steps.length - 1 && (
                <div className={cn(
                  "absolute top-5 left-[calc(50%+20px)] w-[calc(100%-40px)] h-0.5 bg-border -z-0 rounded-full",
                  idx < finalIdx && "bg-success"
                )} />
              )}
            </div>
          );
        })}
      </div>
      {status.toLowerCase() === 'rejected' && (
        <div className="mt-6 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-center text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
          <XCircle size={14} /> Commande Rejetée
        </div>
      )}
    </div>
  );
}

// ── Data Row ──────────────────────────────────────────────────────────────────

function DataRow({ icon: Icon, label, value, mono = false }: { icon?: any; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-3 px-2 rounded-xl transition-colors">
      <div className="flex items-center gap-2.5">
        {Icon && <div className="p-1.5 rounded-lg bg-background/50 text-text-light"><Icon size={14} /></div>}
        <span className="text-[11px] font-bold uppercase tracking-widest text-text-light leading-none">{label}</span>
      </div>
      <span className={cn(
        "text-sm font-semibold text-text-main text-right break-all max-w-[60%]",
        mono && "font-mono text-xs bg-primary/5 text-primary px-2 py-0.5 rounded border border-primary/10"
      )}>
        {value || "—"}
      </span>
    </div>
  );
}

// ── Timeline Item ───────────────────────────────────────────────────────────────

function TimelineItem({ log, isLast }: { log: OrderAuditLog; isLast: boolean }) {
  const getIcon = () => {
    switch (log.actorType) {
      case "admin": return <User size={14} />;
      case "system": return <Activity size={14} />;
      case "webhook": return <RefreshCcw size={14} />;
      default: return <History size={14} />;
    }
  };

  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center">
        <div className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center border transition-all shadow-sm",
          log.actorType === "admin" ? "bg-primary-light text-primary border-primary/20" : "bg-background text-text-light border-border"
        )}>
          {getIcon()}
        </div>
        {!isLast && <div className="w-0.5 h-full bg-border/50 my-1" />}
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-bold text-xs text-text-main uppercase tracking-tight">{log.actionLabel}</span>
          <span className="text-[10px] font-semibold text-text-light bg-background px-2 py-0.5 rounded-full border border-border">
            {new Date(log.createdAt).toLocaleString("fr-FR", { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
          </span>
        </div>
        <div className="text-xs text-text-light bg-background/30 p-3 rounded-xl border border-border/30">
          <div className="flex items-center gap-1.5 mb-1 text-text-main font-bold">
            <User size={10} className="text-primary" /> {log.actorEmail || log.actorType.toUpperCase()}
          </div>
          {log.emailSentTo && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/20 italic opacity-80">
              <Mail size={10} /> Notification ➔ <span className="text-primary">{log.emailSentTo}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modals ─────────────────────────────────────────────────────────

function ActionModal({ isOpen, onClose, title, desc, icon: Icon, colorClass, action, isPending, children }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-text-main/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in text-left">
      <div className="card p-8 w-full max-w-md rounded-2xl border-border shadow-2xl animate-slide-up">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm", colorClass)}>
          <Icon size={28} />
        </div>
        <h3 className="text-xl font-bold text-text-main mb-2 tracking-tight">{title}</h3>
        <p className="text-text-light text-sm leading-relaxed mb-6">{desc}</p>
        {children}
        <div className="grid grid-cols-2 gap-3 mt-8">
          <button className="btn btn-secondary py-3 font-semibold" onClick={onClose}>Annuler</button>
          <button
            className={cn("btn py-3 font-semibold text-white shadow-md flex items-center justify-center gap-2", action.bg)}
            onClick={action.fn}
            disabled={isPending}
          >
            {isPending ? <Loader2 size={18} className="animate-spin" /> : action.label}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);
  const queryClient = useQueryClient();

  const [modals, setModals] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [creds, setCreds] = useState({ u: "", p: "" });

  const { data: orderData, isLoading: orderLoading, error: orderError } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const response = await adminApi.getOrder(orderId);
      return response.data as { success: boolean; data: { order: Order; auditHistory: OrderAuditLog[] } };
    },
    enabled: !!orderId,
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["order-audit", orderId],
    queryFn: async () => {
      const response = await adminApi.getOrderAudit(orderId, { limit: 50 });
      return response.data as { success: boolean; data: OrderAuditLog[] };
    },
    enabled: !!orderId,
  });

  const mutation = useMutation({
    mutationFn: (args: any) => args.type === "val" ? adminApi.validateOrder(orderId, args.data) : adminApi.completeOrder(orderId, args.data),
    onSuccess: () => {
      toast.success("Action effectuée avec succès");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["order-audit", orderId] });
      setModals({});
    },
    onError: () => toast.error("Une erreur est survenue")
  });

  const order = orderData?.data?.order;
  const auditLogs = auditData?.data ?? orderData?.data?.auditHistory ?? [];

  if (orderLoading) return <div className="p-20 flex justify-center"><Loader2 size={40} className="animate-spin text-primary" /></div>;
  if (orderError || !order) return <div className="p-8"><div className="glass p-6 border-danger/30 text-danger rounded-3xl flex items-center gap-3"><AlertCircle /> Erreur lors du chargement</div></div>;

  const status = (order.status as string).toLowerCase();

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="btn-secondary h-11 w-11 flex items-center justify-center p-0">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title leading-none">Commande <span className="gradient-text">{order.reference}</span></h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="text-xs text-text-light mt-1 font-medium flex items-center gap-1.5">
              <Calendar size={12} /> {new Date(order.createdAt).toLocaleDateString("fr-FR", { dateStyle: 'long' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === "payment_confirmed" && (
            <>
              <button className="btn btn-primary h-11 px-6 shadow-glow" onClick={() => setModals({ val: true })}>
                <CheckCircle size={18} /> Valider
              </button>
              <button className="btn btn-secondary h-11 px-6 text-danger hover:bg-danger/5 hover:border-danger/30" onClick={() => setModals({ rej: true })}>
                <XCircle size={18} /> Rejeter
              </button>
            </>
          )}
          {status === "validated" && (
            <button className="btn btn-primary h-11 px-6 shadow-glow" onClick={() => setModals({ complete: true })}>
              <Send size={18} /> Envoyer l'accès
            </button>
          )}
        </div>
      </div>

      {/* Workflow Tracker */}
      <WorkflowTracker status={order.status} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          {/* Main Info Card */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-border bg-background/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-main flex items-center gap-2 uppercase tracking-wider">
                <Package size={16} className="text-primary" /> Détails de l'Inscription
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                <DataRow label="Formation" value={order.formationName || order.lmsItemId} />
                <DataRow label="Support" value={<span className="capitalize">{order.lmsItemType}</span>} />
                <DataRow label="Paiement Brut" value={<span className="text-lg font-bold text-primary">{formatXAF(Number(order.totalAmount))}</span>} />
                <DataRow label="Devise" value={order.currency} />
                <DataRow label="Bénéficiaire" value={order.purchaseType === 'gift' ? '🎁 Cadeau' : '👤 Personnel'} />
                <DataRow label="Confirmé le" value={order.paidAt ? new Date(order.paidAt).toLocaleString("fr-FR", { dateStyle: 'short', timeStyle: 'short' }) : "En attente"} />
              </div>

              <div className="mt-8 pt-8 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-background/50 border border-border">
                  <DataRow label="Passerelle" value={order.paymentProvider} />
                  <DataRow label="Ref. Transaction" value={order.transactionReference} mono />
                  <DataRow label="IntentID" value={order.paymentIntentId} mono />
                </div>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex flex-col justify-center">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-1 ml-2">Notes & Context</label>
                  <p className="text-xs font-semibold text-text-main px-2 italic line-clamp-3">{order.adminNotes || order.rejectionReason || "Aucune note administrative enregistrée."}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Client Card */}
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-border bg-background/50">
              <h3 className="text-sm font-bold text-text-main flex items-center gap-2 uppercase tracking-wider">
                <User size={16} className="text-primary" /> Informations Acheteur
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <DataRow icon={User} label="Nom / Prénom" value={`${order.customerName || ""} ${order.customerSurname || ""}`} />
                <DataRow icon={Mail} label="Contact Email" value={order.customerEmail} />
                <DataRow icon={Phone} label="Téléphone" value={order.customerPhone} />
              </div>
              <div className="space-y-1">
                <DataRow icon={MapPin} label="Localisation" value={order.customerCity} />
                {order.purchaseType === 'gift' && <DataRow icon={Gift} label="Email Bénéficiaire" value={order.beneficiaryEmail} />}
              </div>
            </div>
          </div>
        </div>

        {/* Audit Sidebar */}
        <div className="lg:col-span-4 h-full">
          <div className="card overflow-hidden h-full flex flex-col">
            <div className="p-5 border-b border-border bg-background/50">
              <h3 className="text-sm font-bold text-text-main flex items-center gap-2 uppercase tracking-wider">
                <History size={16} className="text-primary" /> Historique Workflow
              </h3>
            </div>

            <div className="p-6 flex-1 overflow-y-auto max-h-[800px] scroll-area">
              {auditLoading ? (
                <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-primary" /></div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-10">
                  <History size={24} className="text-text-light/20 mx-auto mb-2" />
                  <p className="text-text-light text-xs italic">Aucun événement.</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {auditLogs.map((log, index) => (
                    <TimelineItem key={log.id} log={log} isLast={index === auditLogs.length - 1} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Modals */}
      <ActionModal
        isOpen={modals.val} onClose={() => setModals({})}
        title="Valider la réception" desc="Cette commande sera confirmée et une facture sera automatiquement générée."
        icon={CheckCircle} colorClass="bg-success-light text-success-dark"
        action={{ label: "Valider", bg: "bg-success hover:bg-success-dark", fn: () => mutation.mutate({ type: "val", data: { action: "validate", notes } }) }}
        isPending={mutation.isPending}
      >
        <textarea className="input w-full p-4 h-24 mt-4" placeholder="Notes de validation ou observations..." value={notes} onChange={e => setNotes(e.target.value)} />
      </ActionModal>

      <ActionModal
        isOpen={modals.rej} onClose={() => setModals({})}
        title="Rejeter la commande" desc="Le client sera notifié de l'annulation. Veuillez préciser le motif."
        icon={XCircle} colorClass="bg-danger-light text-danger-dark"
        action={{ label: "Rejeter", bg: "bg-danger hover:bg-danger-dark font-bold", fn: () => mutation.mutate({ type: "val", data: { action: "reject", notes } }) }}
        isPending={mutation.isPending}
      >
        <textarea className="input w-full p-4 h-24 mt-4 border-danger/30 focus:border-danger" placeholder="Motif du rejet (visible par le client)..." value={notes} onChange={e => setNotes(e.target.value)} />
      </ActionModal>

      <ActionModal
        isOpen={modals.complete} onClose={() => setModals({})}
        title="Accès Campus LearnPress"
        desc="Dernière étape du workflow. Les identifiants seront envoyés par email."
        icon={Send} colorClass="bg-primary-light text-primary-dark"
        action={{ label: "Envoyer l'accès", bg: "bg-primary hover:bg-primary-dark shadow-glow font-bold", fn: () => mutation.mutate({ type: "complete", data: { username: creds.u, password: creds.p } }) }}
        isPending={mutation.isPending}
      >
        <div className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-light ml-1">Identifiant Campus</label>
            <input
              className="input h-12 w-full"
              placeholder="ex: p.nom"
              value={creds.u}
              onChange={e => setCreds({ ...creds, u: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-light ml-1">Mot de passe temporaire</label>
            <div className="relative">
              <input
                className="input h-12 w-full font-mono pr-24"
                placeholder="••••••••"
                value={creds.p}
                onChange={e => setCreds({ ...creds, p: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setCreds({ ...creds, p: Math.random().toString(36).slice(-8).toUpperCase() })}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary hover:text-white transition-all uppercase"
              >
                Générer
              </button>
            </div>
          </div>
        </div>
      </ActionModal>
    </div>
  );
}
