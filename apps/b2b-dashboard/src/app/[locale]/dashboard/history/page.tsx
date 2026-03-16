"use client";

import { useTranslations } from "next-intl";
import { History, FileText, Download, ExternalLink, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { b2bPackages } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function HistoryPage() {
  const t = useTranslations("nav");
  const { data: historyData, isLoading } = useQuery({
    queryKey: ["b2b-history"],
    queryFn: async () => {
      // For now, we reuse the packages data but could have a specific endpoint for transactions
      const response = await b2bPackages.getAll();
      return response.data.data;
    }
  });

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
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Package</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Date</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Montant</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Licences</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted">Statut</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-muted text-right">Facture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map((tx: any, index: number) => (
                <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <span className="font-bold text-text-main group-hover:text-primary transition-colors">
                        {tx.package?.title || "Package Formation"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-text-light">
                    {format(new Date(tx.created_at || Date.now()), "d MMMM yyyy", { locale: fr })}
                  </td>
                  <td className="px-6 py-5 font-bold text-text-main">
                    {(tx.package?.price || 0).toLocaleString()}€
                  </td>
                  <td className="px-6 py-5 text-sm text-text-main font-medium">
                    {tx.total_licenses}
                  </td>
                  <td className="px-6 py-5">
                    <span className="badge badge-success">Complété</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button className="p-2 rounded-xl text-text-muted hover:text-primary hover:bg-primary/10 transition-all">
                      <Download className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
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
