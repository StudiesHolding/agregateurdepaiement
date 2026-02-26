"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/lib/api";
import { formatXAF, cn } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";
import {
  Search,
  Filter,
  Calendar,
  RefreshCcw,
  Plus,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Send,
  Package,
  Eye,
  Loader2,
  CreditCard
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

interface OrdersResponse {
  success: boolean;
  data: Order[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

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

function PurchaseTypeBadge({ type }: { type: string }) {
  return (
    <span className={cn(
      "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider",
      type === "gift" ? "bg-info-light text-info-dark" : "bg-background text-text-light border border-border"
    )}>
      {type === "gift" ? "🎁 Cadeau" : "👤 Perso"}
    </span>
  );
}

// ── Modals ─────────────────────────────────────────────────────────

function ActionModal({
  isOpen, onClose, title, desc, icon: Icon, colorClass, action, isPending, children
}: any) {
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

// ── Main Page Component ────────────────────────────────────────────────────────

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    page: 1,
    search: "",
    status: "",
    purchaseType: "",
  });

  const [actionOrderId, setActionOrderId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"validate" | "reject" | "complete" | null>(null);
  const [credentials, setCredentials] = useState({ username: "", password: "" });

  const { data, isLoading, isFetching } = useQuery<OrdersResponse>({
    queryKey: ["orders", filters],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page: filters.page,
        limit: 15,
      };
      if (filters.status) params.status = filters.status;
      if (filters.purchaseType) params.purchaseType = filters.purchaseType;
      if (filters.search) params.search = filters.search;

      const response = await adminApi.getOrders(params);
      return response.data;
    },
  });

  const validateMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "validate" | "reject" }) =>
      adminApi.validateOrder(id, { action }),
    onSuccess: (_, variables) => {
      toast.success(variables.action === "validate" ? "Commande validée" : "Commande rejetée");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setActionOrderId(null);
      setActionType(null);
    },
    onError: () => toast.error("Une erreur est survenue"),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, username, password }: { id: number; username: string; password: string }) =>
      adminApi.completeOrder(id, { username, password }),
    onSuccess: () => {
      toast.success("Commande finalisée");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setActionOrderId(null);
      setActionType(null);
      setCredentials({ username: "", password: "" });
    },
    onError: () => toast.error("Erreur lors de la finalisation"),
  });

  const orders = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, perPage: 15, totalPages: 0 };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title leading-tight">Workflow <span className="gradient-text text-primary">Formations</span></h1>
          <p className="text-sm text-text-light font-medium mt-1">Gérez le cycle de vie des inscriptions et des paiements LMS.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
            className="group btn-secondary h-12 px-6 flex items-center justify-center gap-2 bg-white/50 backdrop-blur-md border hover:border-primary/30 transition-all rounded-2xl shadow-sm"
          >
            <RefreshCcw size={18} className={cn("text-primary transition-transform duration-500", isFetching && "animate-spin")} />
            <span className="text-xs font-bold uppercase tracking-widest text-text-main">Rafraîchir</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Premium Logic */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
        {[
          { label: "Total Commandes", value: meta.total, icon: Package, color: "text-primary bg-primary/10 border-primary/20" },
          { label: "En Confirmation", value: orders.filter(o => o.status === 'payment_confirmed').length, icon: CreditCard, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
          { label: "A Finaliser", value: orders.filter(o => o.status === 'validated').length, icon: Send, color: "text-info bg-info/10 border-info/20" },
          { label: "Terminées", value: orders.filter(o => o.status === 'completed').length, icon: CheckCircle, color: "text-success bg-success/10 border-success/20" },
        ].map((stat, i) => (
          <div key={i} className="card p-6 border-b-4 border-b-primary shadow-sm group hover:scale-[1.02] transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl transition-colors", stat.color)}>
                <stat.icon size={22} />
              </div>
              <ArrowUpRight size={14} className="text-text-light opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-text-light tracking-widest mb-1">{stat.label}</span>
              <span className="text-3xl font-black text-text-main tracking-tight">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="card p-4 flex flex-wrap items-center gap-4 bg-background/30">
        <div className="relative flex-1 min-w-[280px]">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-light" />
          <input
            type="text"
            placeholder="Rechercher par réf, email..."
            className="input pl-12 h-12"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
          />
        </div>
        <select
          className="input h-12 w-full md:w-48 bg-surface border-border/50"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
        >
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="payment_confirmed">Confirmé</option>
          <option value="validated">Validée</option>
          <option value="completed">Terminée</option>
          <option value="rejected">Rejetée</option>
        </select>
        <select
          className="input h-12 w-full md:w-40 bg-surface border-border/50"
          value={filters.purchaseType}
          onChange={(e) => setFilters({ ...filters, purchaseType: e.target.value, page: 1 })}
        >
          <option value="">Types d'achat</option>
          <option value="self">Personnel</option>
          <option value="gift">Cadeau</option>
        </select>
      </div>

      {/* Table Card */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto scroll-area">
          <table className="data-table">
            <thead>
              <tr className="bg-background/50">
                <th>Référence</th>
                <th>Client</th>
                <th>Montant</th>
                <th>Type</th>
                <th>Date</th>
                <th>Statut</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j}><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center opacity-40 italic">Aucune commande trouvée</td>
                </tr>
              ) : (
                orders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-primary/5 transition-colors">
                    <td className="font-mono font-bold text-primary text-xs">{order.reference}</td>
                    <td>
                      <div className="flex flex-col">
                        <span className="font-semibold text-text-main leading-tight">{order.customerEmail}</span>
                        <span className="text-[10px] text-text-light uppercase tracking-tight">{order.customerName} {order.customerSurname}</span>
                      </div>
                    </td>
                    <td><span className="font-bold text-text-main">{formatXAF(Number(order.totalAmount))}</span></td>
                    <td><PurchaseTypeBadge type={order.purchaseType || 'self'} /></td>
                    <td>
                      <div className="flex items-center gap-1.5 text-text-light">
                        <Calendar size={12} />
                        <span className="text-xs font-medium">{new Date(order.createdAt).toLocaleDateString("fr-FR")}</span>
                      </div>
                    </td>
                    <td><OrderStatusBadge status={order.status} /></td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {order.status.toLowerCase() === "payment_confirmed" && (
                          <button
                            onClick={() => { setActionOrderId(order.id); setActionType("validate"); }}
                            className="p-2 rounded-xl bg-success-light text-success-dark hover:bg-success hover:text-white transition-all shadow-sm"
                            title="Valider"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                        {order.status.toLowerCase() === "validated" && (
                          <button
                            onClick={() => { setActionOrderId(order.id); setActionType("complete"); }}
                            className="p-2 rounded-xl bg-primary-light text-primary-dark hover:bg-primary hover:text-white transition-all shadow-sm"
                            title="Finaliser"
                          >
                            <Send size={16} />
                          </button>
                        )}
                        <Link
                          href={`/orders/${order.id}`}
                          className="p-2 rounded-xl bg-background border border-border text-text-light hover:text-primary hover:border-primary transition-all"
                          title="Détails"
                        >
                          <Eye size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between p-6 bg-background/5 border-t border-border/50">
            <div className="text-xs font-bold text-text-light uppercase tracking-wider">
              Page {meta.page} / {meta.totalPages} • <span className="text-text-main">{meta.total} résultats</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-background/50 text-text-light hover:bg-primary hover:text-white transition-all disabled:opacity-30"
                disabled={meta.page <= 1}
                onClick={() => setFilters({ ...filters, page: meta.page - 1 })}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-background/50 text-text-light hover:bg-primary hover:text-white transition-all disabled:opacity-30"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setFilters({ ...filters, page: meta.page + 1 })}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Modals */}
      <ActionModal
        isOpen={actionOrderId && (actionType === "validate" || actionType === "reject")}
        onClose={() => { setActionOrderId(null); setActionType(null); }}
        title={actionType === "validate" ? "Valider la commande" : "Rejeter la commande"}
        desc={actionType === "validate" ? "Voulez-vous valider cette inscription ? Le client recevra sa facture par email." : "Souhaitez-vous rejeter cette commande ?"}
        icon={actionType === "validate" ? CheckCircle : XCircle}
        colorClass={actionType === "validate" ? "bg-success-light text-success-dark" : "bg-danger-light text-danger-dark"}
        action={{
          label: actionType === "validate" ? "Valider" : "Rejeter",
          bg: actionType === "validate" ? "bg-success hover:bg-success-dark" : "bg-danger hover:bg-danger-dark",
          fn: () => validateMutation.mutate({ id: actionOrderId!, action: actionType as any })
        }}
        isPending={validateMutation.isPending}
      />

      <ActionModal
        isOpen={actionOrderId && actionType === "complete"}
        onClose={() => { setActionOrderId(null); setActionType(null); }}
        title="Accès Campus LearnPress"
        icon={Send}
        colorClass="bg-primary-light text-primary-dark"
        action={{
          label: "Envoyer l'accès",
          bg: "bg-primary hover:bg-primary-dark shadow-glow font-bold",
          fn: () => completeMutation.mutate({ id: actionOrderId!, username: credentials.username, password: credentials.password })
        }}
        isPending={completeMutation.isPending}
      >
        <div className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-light ml-1">Identifiant Campus</label>
            <input
              className="input h-12 w-full"
              placeholder="ex: p.nom"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-light ml-1">Mot de passe temporaire</label>
            <div className="relative">
              <input
                className="input h-12 w-full font-mono pr-24"
                placeholder="••••••••"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setCredentials({ ...credentials, password: Math.random().toString(36).slice(-8).toUpperCase() })}
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
