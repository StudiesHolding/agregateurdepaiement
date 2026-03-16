"use client";

import { useTranslations, useLocale } from "next-intl";
import { Package, Key, Users, MoreVertical, Plus, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { b2bPackages } from "@/lib/api";
import { useState } from "react";
import { AssignLicenseModal } from "@/components/modals/AssignLicenseModal";
import { PackageDetailDrawer } from "@/components/modals/PackageDetailDrawer";
import Link from "next/link";

export default function PackagesPage() {
  const t = useTranslations("packages");
  const locale = useLocale();
  const [selectedPkgForAssign, setSelectedPkgForAssign] = useState<{id: number, name: string} | null>(null);
  const [viewingPkg, setViewingPkg] = useState<any>(null);

  const { data: packagesData, isLoading, error } = useQuery({
    queryKey: ["b2b-packages"],
    queryFn: async () => {
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

  const packages = packagesData || [];
  const totalLicenses = packages.reduce((s: number, p: any) => s + (p.total_licenses || 0), 0);
  const usedLicenses = packages.reduce((s: number, p: any) => s + (p.used_licenses || 0), 0);
  const availableLicenses = totalLicenses - usedLicenses;

  const summary = [
    {
      label: t("totalLicenses"),
      value: totalLicenses,
      icon: Key,
      color: "primary",
    },
    {
      label: t("usedLicenses"),
      value: usedLicenses,
      icon: Users,
      color: "success",
    },
    {
      label: t("availableLicenses"),
      value: availableLicenses,
      icon: Package,
      color: "warning",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-text-light">{t("subtitle")}</p>
        </div>
        <Link href={`/${locale}/dashboard/catalog`} className="btn btn-primary shadow-glow">
          <Plus className="h-5 w-5" />
          {t("buyMore")}
        </Link>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {summary.map((item) => (
          <div key={item.label} className="card group flex items-center gap-5 hover:scale-[1.02] transition-all duration-300">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-glow-sm transition-transform group-hover:scale-110",
                item.color === "primary" && "bg-primary/10 text-primary",
                item.color === "success" && "bg-success/10 text-success",
                item.color === "warning" && "bg-warning/10 text-warning"
              )}
            >
              <item.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-text-main tracking-tight">{item.value}</p>
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Package Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {packages.map((pkg: any, index: number) => {
          const used = pkg.used_licenses || 0;
          const total = pkg.total_licenses || 0;
          const available = total - used;
          const pct = total > 0 ? Math.round((used / total) * 100) : 0;
          const title = pkg.package?.title || pkg.name || pkg.title;

          return (
            <div
              key={pkg.id}
              className="card group animate-slide-up flex flex-col hover:border-primary/20 transition-all duration-300"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-600 text-white shadow-glow transform transition-transform group-hover:rotate-3">
                    <Package className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-text-main group-hover:text-primary transition-colors">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm text-text-light line-clamp-2 italic leading-relaxed">
                      {pkg.package?.description || pkg.description}
                    </p>
                  </div>
                </div>
                <button className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-background transition-all">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>

              {/* License gauge */}
              <div className="mt-6 flex-1">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    {t("usedLicenses")}
                  </span>
                  <span className="text-xs font-black text-text-main">
                    {used} / {total} <span className="text-text-muted font-normal">({pct}%)</span>
                  </span>
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

              {/* Footer */}
              <div className="mt-6 flex flex-col space-y-4 pt-5 border-t border-white/5">
                <div className="flex flex-wrap gap-2">
                  {pkg.package?.packageFormations?.slice(0, 3).map((pf: any, i: number) => (
                    <span key={i} className="text-[10px] font-bold bg-white/5 text-text-muted px-2 py-0.5 rounded border border-white/5">
                      {pf.globalCourse?.title || pf.specificCourse?.title || "Formation"}
                    </span>
                  ))}
                  {(pkg.package?.packageFormations?.length > 3) && (
                    <span className="text-[10px] font-bold text-primary px-2 py-0.5">+{pkg.package.packageFormations.length - 3} plus</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <span className={cn(
                      "badge font-bold py-1 px-3",
                      available > 5 ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"
                    )}>
                      {available} {t("availableLicenses").toLowerCase()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                    className="btn btn-ghost text-xs py-2 px-4 hover:bg-white/5 transition-colors"
                    onClick={() => setViewingPkg(pkg)}
                  >
                    <Eye className="h-4 w-4" />
                    {t("viewDetails")}
                  </button>
                  <button 
                    disabled={available <= 0}
                    onClick={() => setSelectedPkgForAssign({ id: pkg.id, name: title })}
                    className="btn btn-primary text-xs py-2 px-4 shadow-glow-sm"
                  >
                    {t("assignLicense")}
                  </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {packages.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-center glass-dark rounded-3xl border border-white/5 animate-fade-in">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-8 shadow-glow">
            <Package className="h-12 w-12" />
          </div>
          <h3 className="text-xl font-black text-text-main">Aucun package actif</h3>
          <p className="text-sm text-text-light max-w-sm mt-3 leading-relaxed">
            Vous n'avez pas encore acheté de packages de formation pour votre entreprise.
          </p>
          <Link href={`/${locale}/dashboard/catalog`} className="btn btn-primary mt-8 shadow-glow px-8">
            Parcourir le catalogue
          </Link>
        </div>
      )}

      <AssignLicenseModal
        isOpen={!!selectedPkgForAssign}
        onClose={() => setSelectedPkgForAssign(null)}
        packageId={selectedPkgForAssign?.id}
        packageName={selectedPkgForAssign?.name}
      />

      <PackageDetailDrawer
        isOpen={!!viewingPkg}
        onClose={() => setViewingPkg(null)}
        pkg={viewingPkg}
      />
    </div>
  );
}
