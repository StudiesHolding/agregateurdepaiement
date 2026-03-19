"use client";

import { useTranslations } from "next-intl";
import { History, FileText, Download, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { b2bOrders } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";
import { toast } from "sonner";

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-warning-light", text: "text-warning-dark", label: "En attente" },
  processing: { bg: "bg-primary-100", text: "text-primary-700", label: "En cours" },
  completed: { bg: "bg-success-light", text: "text-success-dark", label: "Complété" },
  paid: { bg: "bg-success-light", text: "text-success-dark", label: "Payé" },
  failed: { bg: "bg-danger-light", text: "text-danger-dark", label: "Échoué" },
  cancelled: { bg: "bg-danger-light", text: "text-danger-dark", label: "Annulé" },
};

export default function HistoryPage() {
  const t = useTranslations("nav");
  const queryClient = useQueryClient();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["b2b-orders"],
    queryFn: async () => {
      const response = await b2bOrders.getAll();
      return response.data.data;
    }
  });

  const downloadInvoice = async (orderId: number) => {
    setDownloadingId(orderId);
    try {
      const response = await b2bOrders.getInvoice(orderId);

      // Create a blob from the PDF data
      const blob = new Blob([response.data], { type: "application/pdf" });

      // Create a link to download the PDF
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `facture-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();

      // Clean up
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Facture téléchargée avec succès");
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error(error.response?.data?.message || "Erreur lors du téléchargement");
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const transactions = historyData || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-main tracking-tight">Historique d'achats</h1>
        <p className="mt-1 text-sm text-text-light">Consultez et téléchargez les factures de vos packages de formation.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Commande</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Montant</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Licences</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Statut</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted text-right">Facture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map((tx: any, index: number) => {
                const status = statusConfig[tx.status] || statusConfig.pending;
                const canDownload = tx.status === "completed" || tx.status === "paid";

                return (
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="font-bold text-text-main group-hover:text-primary transition-colors block">
                            {tx.formationName || tx.formationPackage?.title || "Package Formation"}
                          </span>
                          <span className="text-xs text-text-muted">{tx.reference}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-text-light">
                      {tx.createdAt ? format(new Date(tx.createdAt), "d MMMM yyyy", { locale: fr }) : "-"}
                    </td>
                    <td className="px-6 py-5 font-bold text-text-main">
                      {Number(tx.totalAmount || 0).toLocaleString()} {tx.currency || "€"}
                    </td>
                    <td className="px-6 py-5 text-sm text-text-main font-medium">
                      {tx.metadata?.licence_count || tx.total_licenses || "-"}
                    </td>
                    <td className="px-6 py-5">
                      <span className={cn("badge font-bold py-1 px-3", status.bg, status.text)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => downloadInvoice(tx.id)}
                        disabled={!canDownload || downloadingId === tx.id}
                        className={cn(
                          "p-2 rounded-xl transition-all inline-flex items-center justify-center",
                          canDownload
                            ? "text-text-muted hover:text-primary hover:bg-primary/10"
                            : "text-text-muted/30 cursor-not-allowed"
                        )}
                        title={canDownload ? "Télécharger la facture" : "Facture non disponible"}
                      >
                        {downloadingId === tx.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Download className="h-5 w-5" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <History className="h-12 w-12 text-text-muted mb-4" />
            <p className="text-text-main font-bold">Aucun historique</p>
            <p className="text-sm text-text-light">Vos futurs achats apparaîtront ici.</p>
          </div>
        )}
      </div>
    </div>
  );
}
