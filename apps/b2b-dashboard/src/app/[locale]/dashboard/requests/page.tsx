"use client";

import { useTranslations } from "next-intl";
import { Search, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn, formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { b2bRequests } from "@/lib/api";

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

  if (isLoading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-main tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-text-light">{t("subtitle")}</p>
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
                      {req.package}
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
    </div>
  );
}

