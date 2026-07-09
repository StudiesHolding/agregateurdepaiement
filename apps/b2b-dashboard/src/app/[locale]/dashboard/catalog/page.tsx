"use client";

import { useTranslations, useLocale } from "next-intl";
import { ArrowRight, Package, Search, Loader2, Layers, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Image from "next/image";
import { b2bPackages } from "@/lib/api";
import { PackageDetailDrawer } from "@/components/modals/PackageDetailDrawer";

export default function CatalogPage() {
  const t = useTranslations("packages");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [purchasingId, setPurchasingId] = useState<number | null>(null);

  const purchaseThematiqueMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await b2bPackages.purchaseThematique({ thematique_id: id, total_licenses: 10 });
      return res.data;
    },
    onSuccess: (data) => {
      if (data?.data?.redirectUrl) {
        window.location.href = data.data.redirectUrl;
      }
    }
  });

  const handlePurchaseThematique = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setPurchasingId(id);
    purchaseThematiqueMutation.mutate(id, {
      onSettled: () => setPurchasingId(null)
    });
  };

  const { data: catalogData, isLoading: isLoadingPackages } = useQuery({
    queryKey: ["b2b-catalog"],
    queryFn: async () => {
      const response = await b2bPackages.getCatalog();
      return response.data.data;
    },
  });

  const { data: thematiquesData, isLoading: isLoadingThematiques } = useQuery({
    queryKey: ["b2b-thematiques-catalog"],
    queryFn: async () => {
      const response = await b2bPackages.getThematiquesCatalog();
      return response.data.data;
    },
  });

  const isLoading = isLoadingPackages || isLoadingThematiques;

  const filtered = (catalogData || []).filter(
    (pkg: any) =>
      (pkg.name || pkg.title || "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (pkg.description || "").toLowerCase().includes(search.toLowerCase()),
  );

  const filteredThematiques = (thematiquesData || []).filter(
    (th: any) =>
      (th.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (th.description || "").toLowerCase().includes(search.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main tracking-tight">
            Catalogue de Formations
          </h1>
          <p className="mt-1 text-sm text-text-light">
            Découvrez nos packages et thématiques pour former vos équipes dès aujourd'hui.
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-text-muted" />
        <input
          type="text"
          placeholder="Rechercher un package ou une thématique..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-11 shadow-sm"
        />
      </div>

      {/* ── Section Packages ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Package className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold text-text-main">Packages de Formation</h2>
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
                    alt={pkg.name || pkg.title || "Package"}
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
                    {pkg.name || pkg.title || "Package sans nom"}
                  </h3>
                  <p className="mt-2 text-sm text-text-light line-clamp-2 leading-relaxed h-10">
                    {pkg.description}
                  </p>
                </div>

                {/* Formations list */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    Formations incluses
                  </p>
                  <div className="space-y-1.5">
                    {pkg.packageFormations
                      ?.slice(0, 4)
                      .map((pf: any, i: number) => (
                        <div
                          key={pf.id}
                          className="flex items-center gap-2 text-xs text-text-light bg-white/[0.02] p-2 rounded-lg border border-white/5"
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                          <span className="truncate">
                            {pf.globalCourse?.title ||
                              pf.specificCourse?.title ||
                              "Formation"}
                          </span>
                        </div>
                      ))}
                    {pkg.packageFormations?.length > 4 && (
                      <p className="text-[10px] font-medium text-primary pl-4">
                        +{pkg.packageFormations.length - 4} autres formations
                      </p>
                    )}
                    {(!pkg.packageFormations ||
                      pkg.packageFormations.length === 0) && (
                      <p className="text-xs text-text-muted italic ">
                        Contenu en cours de mise à jour
                      </p>
                    )}
                  </div>
                </div>

                {/* Action */}
                <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-tight">
                      Accès Entreprise
                    </span>
                    <span className="text-xs font-semibold text-text-main">
                      Licences illimitées*
                    </span>
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

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center glass-dark rounded-3xl border border-white/5">
            <Search className="h-10 w-10 text-text-muted mb-3" />
            <p className="text-text-main font-bold">Aucun package trouvé</p>
            <p className="text-sm text-text-light">Essayez d'autres termes de recherche.</p>
          </div>
        )}
      </section>

      {/* ── Section Thématiques ───────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
            <Layers className="h-5 w-5" />
          </div>
          <h2 data-testid="thematiques-catalog" className="text-xl font-bold text-text-main">Thématiques</h2>
          <span className="badge bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px] font-bold">
            Accès global à toutes les formations du domaine
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredThematiques.map((th: any, index: number) => (
            <div
              key={th.id}
              data-testid="thematique-card"
              data-thematique-id={th.id}
              className="card group animate-slide-up flex flex-col hover:border-violet-500/30 transition-all duration-300 cursor-pointer"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Color band */}
              <div
                className="h-1.5 rounded-full mb-5"
                style={{ background: th.color || "hsl(260,70%,60%)" }}
              />

              <div className="flex items-start gap-4 flex-1">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-inner"
                  style={{ background: (th.color || "hsl(260,70%,60%)") + "22" }}
                >
                  {th.icon || "🎓"}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-text-main group-hover:text-violet-400 transition-colors line-clamp-1">
                    {th.title}
                  </h3>
                  <p className="mt-1 text-xs text-text-light line-clamp-2 leading-relaxed">
                    {th.description || "Accédez à toutes les formations de cette thématique."}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Accès complet
                </span>
                <button
                  className="btn text-xs py-2 px-4 bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  onClick={(e) => handlePurchaseThematique(e, th.id)}
                  disabled={purchasingId === th.id}
                >
                  {purchasingId === th.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-3.5 w-3.5" />
                  )}
                  Acheter la thématique
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredThematiques.length === 0 && !isLoadingThematiques && (
          <div className="flex flex-col items-center justify-center py-16 text-center glass-dark rounded-3xl border border-white/5">
            <Layers className="h-10 w-10 text-text-muted mb-3" />
            <p className="text-text-main font-bold">Aucune thématique disponible</p>
            <p className="text-sm text-text-light">De nouvelles thématiques seront bientôt ajoutées.</p>
          </div>
        )}
      </section>

      <PackageDetailDrawer
        isOpen={!!selectedPkg}
        onClose={() => setSelectedPkg(null)}
        pkg={selectedPkg}
      />
    </div>
  );
}
