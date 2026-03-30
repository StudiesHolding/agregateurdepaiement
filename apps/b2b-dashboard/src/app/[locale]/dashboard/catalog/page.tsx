"use client";

import { useTranslations, useLocale } from "next-intl";
import { ArrowRight, Package, Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { b2bPackages } from "@/lib/api";
import { PackageDetailDrawer } from "@/components/modals/PackageDetailDrawer";

export default function CatalogPage() {
  const t = useTranslations("packages");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [selectedPkg, setSelectedPkg] = useState<any>(null);

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ["b2b-catalog"],
    queryFn: async () => {
      const response = await b2bPackages.getCatalog();
      return response.data.data;
    }
  });

  const filtered = (catalogData || []).filter((pkg: any) =>
    pkg.title.toLowerCase().includes(search.toLowerCase()) ||
    pkg.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">Catalogue de Formations</h1>
          <p className="mt-1 text-sm text-text-light">Découvrez nos packages et formez vos équipes dès aujourd'hui.</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-text-muted" />
        <input
          type="text"
          placeholder="Rechercher un package..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-11 shadow-sm"
        />
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((pkg: any, index: number) => (
          <div
            key={pkg.id}
            className="card group animate-slide-up flex flex-col hover:border-primary/50 transition-all duration-300 cursor-pointer"
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => setSelectedPkg(pkg)}
          >
            {/* Header Image/Background */}
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden mb-5 bg-surface border border-white/5 shadow-inner">
              {pkg.image_url ? (
                <Image 
                  src={pkg.image_url} 
                  alt={pkg.title} 
                  width={400}
                  height={225}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-transparent">
                  <Package className="h-12 w-12 text-primary/20" />
                </div>
              )}
              <div className="absolute top-3 right-3">
                <span className="badge badge-primary shadow-glow-sm">
                  {pkg.price} {pkg.currency || "€"}
                </span>
              </div>
            </div>

            <div className="flex-1 flex flex-col space-y-4">
              <div>
                <h3 className="text-xl font-bold text-text-main group-hover:text-primary transition-colors line-clamp-1">
                  {pkg.title}
                </h3>
                <p className="mt-2 text-sm text-text-light line-clamp-2 leading-relaxed h-10">
                  {pkg.description}
                </p>
              </div>

              {/* Formations list */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Formations incluses</p>
                <div className="space-y-1.5">
                  {pkg.packageFormations?.slice(0, 4).map((pf: any, i: number) => (
                    <div key={pf.id} className="flex items-center gap-2 text-xs text-text-light bg-white/[0.02] p-2 rounded-lg border border-white/5">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                      <span className="truncate">{pf.globalCourse?.title || pf.specificCourse?.title || "Formation"}</span>
                    </div>
                  ))}
                  {pkg.packageFormations?.length > 4 && (
                    <p className="text-[10px] font-medium text-primary pl-4">+{pkg.packageFormations.length - 4} autres formations</p>
                  )}
                  {(!pkg.packageFormations || pkg.packageFormations.length === 0) && (
                    <p className="text-xs text-text-muted italic ">Contenu en cours de mise à jour</p>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-muted font-bold uppercase tracking-tight">Accès Entreprise</span>
                  <span className="text-xs font-semibold text-text-main">Licences illimitées*</span>
                </div>
                <button
                  className="btn btn-primary h-10 px-4 shadow-glow-sm group/btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPkg(pkg);
                  }}
                >
                  Détails
                  <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <PackageDetailDrawer
        isOpen={!!selectedPkg}
        onClose={() => setSelectedPkg(null)}
        pkg={selectedPkg}
      />

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center glass-dark rounded-3xl border border-white/5">
          <Search className="h-12 w-12 text-text-muted mb-4" />
          <p className="text-text-main font-bold">Aucun résultat</p>
          <p className="text-sm text-text-light">Essayez d'autres termes de recherche.</p>
        </div>
      )}
    </div>
  );
}
