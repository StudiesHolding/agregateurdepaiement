"use client";

import { useTranslations } from "next-intl";
import {
  Package,
  Key,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { b2bDashboard } from "@/lib/api";

const colorMap: Record<string, string> = {
  primary: "from-primary to-primary-400",
  secondary: "from-secondary to-blue-400",
  success: "from-success to-emerald-400",
  warning: "from-warning to-amber-400",
  danger: "from-danger to-rose-400",
};

const iconBgMap: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

const statusColors: Record<string, string> = {
  pending: "bg-warning-light text-warning-dark",
  processing: "bg-primary-100 text-primary-700",
  activated: "bg-success-light text-success-dark",
  rejected: "bg-danger-light text-danger-dark",
};

export default function DashboardPage() {
  const t = useTranslations("stats");
  const tDash = useTranslations("dashboard");
  const tReq = useTranslations("requests");

  const { data: statsData, isLoading, error } = useQuery({
    queryKey: ["b2b-stats"],
    queryFn: async () => {
      const response = await b2bDashboard.getStats();
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

  if (error) {
    return (
      <div className="card border-danger/20 p-8 text-center bg-danger/5">
        <p className="text-danger font-medium">Erreur lors de la récupération des données.</p>
        <button 
          onClick={() => window.location.reload()}
          className="btn btn-primary mt-4 py-2 px-4 shadow-sm"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const kpis = [
    {
      key: "activePackages",
      value: statsData?.usage_by_package?.length || 0,
      icon: Package,
      color: "primary",
      trend: "+1",
    },
    {
      key: "totalLicenses",
      value: statsData?.total_licenses || 0,
      icon: Key,
      color: "secondary",
      trend: null,
    },
    {
      key: "usedLicenses",
      value: statsData?.used_licenses || 0,
      icon: CheckCircle2,
      color: "success",
      trend: null,
    },
    {
      key: "availableLicenses",
      value: (statsData?.total_licenses || 0) - (statsData?.used_licenses || 0),
      icon: TrendingUp,
      color: "warning",
      trend: null,
    },
    {
      key: "pendingRequests",
      value: statsData?.pending_requests || 0,
      icon: Clock,
      color: "danger",
      trend: null,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-text-main tracking-tight">
          {tDash("welcome")} <span className="text-primary italic font-black">Admin</span>
        </h1>
        <p className="mt-1 text-sm text-text-light">{tDash("overview")}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map((stat, index) => (
          <div
            key={stat.key}
            className={cn(
              "card group relative overflow-hidden animate-slide-up",
              `delay-${(index + 1) * 100}`
            )}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            {/* Gradient accent top */}
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
                colorMap[stat.color]
              )}
            />

            <div className="flex items-start justify-between">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  iconBgMap[stat.color]
                )}
              >
                <stat.icon className="h-5 w-5" />
              </div>
              {stat.trend && (
                <span className="flex items-center gap-0.5 text-xs font-medium text-success">
                  <ArrowUpRight className="h-3 w-3" />
                  {stat.trend}
                </span>
              )}
            </div>

            <div className="mt-4">
              <p className="text-2xl font-bold text-text-main">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-text-muted">{t(stat.key)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* License Usage Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-text-main">
                Utilisation des licences
              </h3>
              <p className="text-sm text-text-muted">
                Répartition par package
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {statsData?.usage_by_package?.map((pkg: any) => {
              const pct = Math.round((pkg.used / pkg.total) * 100);
              return (
                <div key={pkg.name} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-text-main group-hover:text-primary transition-colors">
                      {pkg.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-muted">
                        {pkg.used}/{pkg.total}
                      </span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                        pct >= 90 ? "bg-danger/10 text-danger" : pct >= 70 ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                      )}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-background overflow-hidden border border-white/5 shadow-inner">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-1000 ease-out shadow-glow-sm",
                        pct >= 90
                          ? "bg-gradient-to-r from-danger to-rose-400"
                          : pct >= 70
                          ? "bg-gradient-to-r from-warning to-amber-400"
                          : "bg-gradient-to-r from-primary to-primary-400"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-main mb-5">
            Activité récente
          </h3>
          <div className="space-y-1">
            {statsData?.recent_activity?.map((activity: any) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 rounded-xl p-3.5 hover:bg-background/50 transition-all duration-200 border border-transparent hover:border-white/5"
              >
                <div className="mt-0.5 shadow-sm">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl",
                      activity.action === "package_purchased"
                        ? "bg-primary/10 text-primary"
                        : activity.action === "license_assigned" || activity.action === "access_activated"
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    )}
                  >
                    {activity.action === "package_purchased" ? (
                      <Package className="h-4.5 w-4.5" />
                    ) : activity.action === "license_assigned" || activity.action === "access_activated" ? (
                      <CheckCircle2 className="h-4.5 w-4.5" />
                    ) : (
                      <Users className="h-4.5 w-4.5" />
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-main truncate">
                    {activity.user}
                  </p>
                  <p className="text-xs text-text-light truncate mt-0.5">
                    {activity.action === 'license_assigned' ? 'Licence attribuée' : activity.package}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={cn(
                      "badge text-[10px] font-bold py-0.5 px-2",
                      statusColors[activity.status]
                    )}
                  >
                    {tReq(activity.status as any)}
                  </span>
                  <span className="text-[10px] font-medium text-text-muted italic">
                    {activity.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

