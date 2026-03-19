"use client";

import { useTranslations } from "next-intl";
import { Search, Clock, CheckCircle2, XCircle, Loader2, Eye, Info, Download } from "lucide-react";
import { useState } from "react";
import { cn, formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { b2bRequests, b2bExport } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { toast } from "sonner";

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  pending: {
    icon: Clock,
    color: "text-warning-dark",
    bg: "bg-warning-light",
  },
  processing: {
    icon: Loader2,
    color: "text-primary-700",
    bg: "bg-primary-100",
  },
  activated: {
    icon: CheckCircle2,
    color: "text-success-dark",
    bg: "bg-success-light",
  },
  rejected: {
    icon: XCircle,
    color: "text-danger-dark",
    bg: "bg-danger-light",
  },
};

export default function RequestsPage() {
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
  const [filter, setFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const { data: requestsData, isLoading } = useQuery({
    queryKey: ["b2b-requests"],
    queryFn: async () => {
      const response = await b2bRequests.getAll();
      return response.data.data;
    }
  });

  const requests = requestsData || [];

  const filtered =
    filter === "all"
      ? requests
      : requests.filter((r: any) => r.status === filter);

  const counts: any = {
    all: requests.length,
    pending: requests.filter((r: any) => r.status === "pending").length,
    processing: requests.filter((r: any) => r.status === "processing").length,
    activated: requests.filter((r: any) => r.status === "activated").length,
    rejected: requests.filter((r: any) => r.status === "rejected").length,
  };

  const downloadCSV = () => {
    // CSV Header
    const headers = ['Collaborateur', 'Email', 'Département', 'Poste', 'Package', 'Statut', 'Date de création'];

    // CSV Rows from filtered data
    const rows: string[][] = filtered.map((req: any) => [
      `${req.employee?.first_name || ''} ${req.employee?.last_name || ''}`.trim(),
      req.employee?.email || '',
      req.employee?.department || '',
      req.employee?.position || '',
      req.companyPackage?.package?.title || req.package || 'Package',
      req.status,
      req.created_at
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row: string[]) => row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `demandes-acces-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success('Téléchargement CSV réussi');
  };

  const downloadPDF = async () => {
    try {
      const response = await b2bExport.exportRequestsPDF();
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `demandes-acces-${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Téléchargement PDF réussi');
    } catch (error: any) {
      console.error('PDF export error:', error);
      toast.error(error.response?.data?.message || 'Erreur lors du téléchargement PDF');
    }
  };

  const openRequestDetails = (request: any) => {
    setSelectedRequest(request);
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
      <div className="flex items-center justify-between w-full">
        <div>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-text-light">{t("subtitle")}</p>
        </div>
        {filtered.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={downloadCSV}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={downloadPDF}
              className="btn btn-primary flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
          </div>
        )}
      </div>

      {/* Info Banner - B2B admins cannot approve/reject */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-text-main text-sm">Gestion des demandes</p>
          <p className="text-xs text-text-muted mt-1">
            Les demandes d'accès aux formations sont traitées par notre équipe administrative.
            Vous pouvez suivre le statut de chaque demande ci-dessous.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "pending", "processing", "activated", "rejected"] as const).map(
          (status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300",
                filter === status
                  ? "bg-primary text-white shadow-glow"
                  : "bg-surface text-text-light border border-white/5 hover:bg-background/80 hover:text-text-main"
              )}
            >
              {status !== "all" && (
                <span
                  className={cn(
                    "flex h-2 w-2 rounded-full shadow-sm",
                    status === "pending" && "bg-warning",
                    status === "processing" && "bg-primary-400",
                    status === "activated" && "bg-success",
                    status === "rejected" && "bg-danger"
                  )}
                />
              )}
              <span className="capitalize">{status === "all" ? "Tous" : t(status)}</span>
              <span
                className={cn(
                  "ml-1.5 text-[10px] font-black rounded-full px-2 py-0.5",
                  filter === status
                    ? "bg-white/20 text-white"
                    : "bg-background text-text-muted border border-white/5"
                )}
              >
                {counts[status] || 0}
              </span>
            </button>
          )
        )}
      </div>

      {/* Request Table */}
      <div className="card p-0 overflow-hidden border-white/5 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-background/30 backdrop-blur-sm">
                <th className="py-4 px-6 text-left text-[10px] font-black text-text-muted uppercase tracking-[0.1em]">
                  Collaborateur
                </th>
                <th className="py-4 px-6 text-left text-[10px] font-black text-text-muted uppercase tracking-[0.1em]">
                  Package
                </th>
                <th className="py-4 px-6 text-left text-[10px] font-black text-text-muted uppercase tracking-[0.1em]">
                  {tCommon("status")}
                </th>
                <th className="py-4 px-6 text-left text-[10px] font-black text-text-muted uppercase tracking-[0.1em]">
                  {tCommon("date")}
                </th>
                <th className="py-4 px-6 text-left text-[10px] font-black text-text-muted uppercase tracking-[0.1em]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((req: any, index: number) => {
                const sc = statusConfig[req.status] || statusConfig.pending;
                const StatusIcon = sc.icon;

                return (
                  <tr
                    key={req.id}
                    className="group hover:bg-white/[0.02] transition-colors animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/10">
                          {req.employee?.first_name?.charAt(0)}{req.employee?.last_name?.charAt(0)}
                        </div>
                        <span className="font-bold text-text-main group-hover:text-primary transition-colors">
                          {req.employee?.first_name} {req.employee?.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-text-light font-medium italic">
                      {req.companyPackage?.package?.title || req.package || "Package"}
                    </td>
                    <td className="py-4 px-6">
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
                        {t(req.status as any)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-text-muted text-xs font-medium">
                      {formatDate(req.created_at)}
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => openRequestDetails(req)}
                        className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title="Voir les détails"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 glass-dark">
            <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-6 shadow-glow-sm">
              <Search className="h-10 w-10 opacity-50" />
            </div>
            <h3 className="text-lg font-bold text-text-main">Aucune demande trouvée</h3>
            <p className="text-sm text-text-light mt-1">Essayez un autre filtre ou revenez plus tard.</p>
          </div>
        )}
      </div>

      {/* Request Details Modal */}
      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Détails de la demande"
      >
        {selectedRequest && (
          <div className="space-y-6">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-muted">Statut</span>
              {(() => {
                const sc = statusConfig[selectedRequest.status] || statusConfig.pending;
                const StatusIcon = sc.icon;
                return (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm",
                      sc.bg,
                      sc.color
                    )}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {t(selectedRequest.status as any)}
                  </span>
                );
              })()}
            </div>

            {/* Employee Info */}
            <div className="bg-background rounded-2xl p-4 border border-white/5">
              <h4 className="text-xs font-black text-text-muted uppercase tracking-wider mb-3">Collaborateur</h4>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary border border-primary/10">
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
              {selectedRequest.employee?.position && (
                <p className="text-sm text-text-muted">
                  Poste: <span className="text-text-main">{selectedRequest.employee.position}</span>
                </p>
              )}
            </div>

            {/* Package Info */}
            <div className="bg-background rounded-2xl p-4 border border-white/5">
              <h4 className="text-xs font-black text-text-muted uppercase tracking-wider mb-3">Package</h4>
              <p className="font-bold text-text-main">
                {selectedRequest.companyPackage?.package?.title || selectedRequest.package || "Package"}
              </p>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background rounded-2xl p-4 border border-white/5">
                <h4 className="text-xs font-black text-text-muted uppercase tracking-wider mb-1">Créé le</h4>
                <p className="font-semibold text-text-main text-sm">
                  {formatDate(selectedRequest.created_at)}
                </p>
              </div>
              {selectedRequest.updated_at && (
                <div className="bg-background rounded-2xl p-4 border border-white/5">
                  <h4 className="text-xs font-black text-text-muted uppercase tracking-wider mb-1">Modifié le</h4>
                  <p className="font-semibold text-text-main text-sm">
                    {formatDate(selectedRequest.updated_at)}
                  </p>
                </div>
              )}
            </div>

            {/* Notes (if any) */}
            {selectedRequest.admin_notes && (
              <div className="bg-warning/5 rounded-2xl p-4 border border-warning/20">
                <h4 className="text-xs font-black text-warning-dark uppercase tracking-wider mb-2">Notes admin</h4>
                <p className="text-sm text-text-main">{selectedRequest.admin_notes}</p>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={() => setSelectedRequest(null)}
              className="btn btn-secondary w-full"
            >
              Fermer
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
