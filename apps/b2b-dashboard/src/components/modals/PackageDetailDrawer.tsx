"use client";

import React, { useEffect, useState } from "react";
import { 
  X, 
  CheckCircle2, 
  Clock, 
  BarChart, 
  Users, 
  Star, 
  ArrowRight, 
  Loader2, 
  ShieldCheck, 
  Award, 
  Zap,
  ChevronDown,
  ShoppingBag,
  Info,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { b2bPackages } from "@/lib/api";
import { toast } from "sonner";

interface PackageDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: any;
}

export function PackageDetailDrawer({ isOpen, onClose, pkg }: PackageDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [expandedCurriculum, setExpandedCurriculum] = useState(true);
  const [displayCurrency, setDisplayCurrency] = useState<"XAF" | "EUR" | "USD">("XAF");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Delay content show for smoother animation
      const timer = setTimeout(() => setShowContent(true), 50);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
      document.body.style.overflow = "unset";
    }
  }, [isOpen]);

  const purchaseMutation = useMutation({
    mutationFn: (data: { package_id: number; total_licenses: number }) => b2bPackages.purchase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["b2b-packages"] });
      queryClient.invalidateQueries({ queryKey: ["b2b-dashboard-stats"] });
      toast.success("Package acquis avec succès !");
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Échec de la transaction");
    }
  });

  if (!mounted || !pkg) return null;

  const formations = pkg.packageFormations || pkg.package?.packageFormations || [];
  const isCatalog = !pkg.company_id;
  const basePrice = (pkg.price || pkg.package?.price || 0);
  const baseCurrency = (pkg.currency || pkg.package?.currency || "EUR");

  // Approximate conversion rates (1 EUR as base)
  const rates = {
    XAF: 655.957,
    EUR: 1,
    USD: 1.08
  };

  const convertPrice = (price: number, from: string, to: string) => {
    // Normalize to EUR first
    const priceInEur = from === "XAF" ? price / rates.XAF : from === "USD" ? price / rates.USD : price;
    // Convert to target
    return priceInEur * rates[to as keyof typeof rates];
  };

  const totalPrice = convertPrice(basePrice, baseCurrency, displayCurrency);

  return (
    <>
      {/* Backdrop with enhanced blur */}
      <div 
        className={cn(
          "fixed inset-0 z-[100] bg-background/60 backdrop-blur-xl transition-all duration-700 ease-out",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Centered Premium Overlay */}
      <div 
        className={cn(
          "fixed z-[101] left-1/2 top-1/2 -translate-x-1/2 w-[95%] max-w-4xl h-[85vh] bg-surface rounded-[40px] border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] flex flex-col scale-0 opacity-0",
          isOpen && showContent ? "scale-100 opacity-100 -translate-y-1/2" : "scale-90 opacity-0 translate-y-[-40%]"
        )}
      >
        {/* Top Decorative bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-secondary to-primary animate-gradient-x shrink-0" />

        {/* Header Section */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 bg-surface/40 backdrop-blur-2xl sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-5">
             <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center text-primary shadow-inner">
                <Zap className="h-6 w-6" />
             </div>
             <div>
                <h2 className="text-xl font-black text-text-main tracking-tight line-clamp-1 max-w-md">
                   {pkg.title || pkg.package?.title}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className="h-2 w-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                   <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Accès Premium Immédiat</span>
                </div>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="group h-10 w-10 rounded-2xl bg-white/5 text-text-muted hover:text-white hover:bg-error/20 flex items-center justify-center transition-all duration-300 hover:rotate-90 active:scale-95 border border-white/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-12 pb-40">
          
          <div className="grid lg:grid-cols-5 gap-10 items-start">
            
            {/* Gallery / Visual part (2/5) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="relative aspect-square rounded-[32px] overflow-hidden border border-white/10 shadow-2xl group ring-1 ring-white/5">
                {pkg.image_url || pkg.package?.image_url ? (
                  <img 
                    src={pkg.image_url || pkg.package?.image_url} 
                    alt="Package Hero" 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-brand flex items-center justify-center">
                    <Star className="h-20 w-20 text-white/10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-60" />
              </div>

              {/* Badges / Trust */}
              <div className="grid grid-cols-2 gap-3">
                 <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center text-center gap-1.5">
                    <ShieldCheck className="h-5 w-5 text-success" />
                    <span className="text-[10px] font-black uppercase text-text-main">Accès Sécurisé</span>
                 </div>
                 <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col items-center justify-center text-center gap-1.5">
                    <Award className="h-5 w-5 text-warning" />
                    <span className="text-[10px] font-black uppercase text-text-main">Certifié</span>
                 </div>
              </div>
            </div>

            {/* Content / Info part (3/5) */}
            <div className="lg:col-span-3 space-y-10">
              
              {/* Introduction */}
              <section className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                   <Info size={12} className="text-primary" />
                   <span className="text-[9px] font-black text-primary uppercase tracking-widest">Description</span>
                </div>
                <p className="text-base text-text-light leading-relaxed font-medium">
                  {pkg.description || pkg.package?.description || "Ce programme d'élite offre une immersion exhaustive dans les compétences clés requises par le marché actuel, harmonisant théorie avancée et cas pratiques industriels."}
                </p>
              </section>

              {/* Stats Highlights */}
              <div className="flex flex-wrap gap-4">
                 {[
                   { icon: Clock, label: "40h de cours", color: "text-primary", bg: "bg-primary/5" },
                   { icon: FileText, label: `${formations.length} Modules`, color: "text-secondary", bg: "bg-secondary/5" },
                   { icon: Users, label: "Public B2B", color: "text-success", bg: "bg-success/5" }
                 ].map((stat, i) => (
                    <div key={i} className={cn("flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-white/5", stat.bg)}>
                       <stat.icon size={16} className={stat.color} />
                       <span className="text-xs font-black text-text-main tracking-tight">{stat.label}</span>
                    </div>
                 ))}
              </div>

              {/* Features List */}
              <section className="space-y-4">
                 <h4 className="text-sm font-black text-text-main uppercase tracking-[0.15em] opacity-80">Avantages Inclus</h4>
                 <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      "Tracking de progression Admin",
                      "Attribution instantanée",
                      "Documentation complète",
                      "Support technique dédié"
                    ].map((benefit, i) => (
                      <div key={i} className="flex items-center gap-3">
                         <div className="h-2 w-2 rounded-full bg-primary/40 shrink-0" />
                         <span className="text-xs font-medium text-text-light">{benefit}</span>
                      </div>
                    ))}
                 </div>
              </section>
            </div>
          </div>

          <hr className="border-white/5" />

          {/* Curriculum Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between bg-white/[0.01] p-2 rounded-3xl border border-white/5">
              <button 
                onClick={() => setExpandedCurriculum(!expandedCurriculum)}
                className="flex items-center justify-between w-full px-6 py-4 rounded-2xl hover:bg-white/5 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                   <div className="h-1 w-12 bg-primary rounded-full group-hover:w-16 transition-all duration-500" />
                   <h3 className="text-lg font-black text-text-main tracking-tight uppercase">Programme de formation détaillé</h3>
                </div>
                <div className="flex items-center gap-3">
                   <span className="text-[10px] font-black text-text-muted uppercase italic">{formations.length} chapitres</span>
                   <ChevronDown className={cn("h-6 w-6 text-primary transition-transform duration-500", expandedCurriculum && "rotate-180")} />
                </div>
              </button>
            </div>
            
            <div className={cn(
               "grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-700 pointer-events-none",
               expandedCurriculum ? "max-h-[3000px] opacity-100 scale-100 pointer-events-auto" : "max-h-0 opacity-0 scale-95"
            )}>
              {formations.map((pf: any, index: number) => {
                const course = pf.globalCourse || pf.specificCourse;
                if (!course) return null;
                
                return (
                  <div 
                    key={pf.id || index} 
                    className="group flex items-center gap-5 p-5 rounded-3xl bg-surface border border-white/[0.04] hover:border-primary/30 hover:bg-primary/[0.02] shadow-sm hover:shadow-glow-sm transition-all duration-300"
                  >
                    <div className="flex-shrink-0 h-10 w-10 rounded-2xl bg-background flex items-center justify-center text-text-muted text-[11px] font-black group-hover:text-primary group-hover:scale-110 transition-all duration-500">
                      {(index + 1).toString().padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-text-main group-hover:text-primary transition-colors truncate tracking-tight">
                        {course.title}
                      </h4>
                      <p className="mt-1 text-[10px] text-text-muted font-bold uppercase tracking-tighter opacity-70">
                        Durée estimée : 4h 30min
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 -translate-x-3 group-hover:translate-x-0 transition-all duration-500" />
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Refined Slim Footer - Integrated & Elegant */}
        <div className="mt-auto border-t border-white/5 bg-surface/60 backdrop-blur-2xl px-10 py-5 shrink-0">
           <div className="flex flex-col sm:flex-row items-center justify-between gap-6 max-w-3xl mx-auto">
              {/* Price & Contract Info */}
              <div className="flex items-center gap-8">
                 <div>
                    <div className="flex items-center gap-3 mb-1">
                       <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Investissement</p>
                       <div className="flex gap-1 bg-white/5 p-0.5 rounded-md">
                          {(["XAF", "EUR", "USD"] as const).map((curr) => (
                             <button
                               key={curr}
                               onClick={() => setDisplayCurrency(curr)}
                               className={cn(
                                 "text-[8px] font-black px-1.5 py-0.5 rounded transition-all",
                                 displayCurrency === curr 
                                   ? "bg-primary text-white shadow-glow-sm" 
                                   : "text-text-muted hover:text-white"
                               )}
                             >
                               {curr}
                             </button>
                          ))}
                       </div>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                       <span className="text-3xl font-black text-primary tracking-tighter drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">
                         {totalPrice.toLocaleString(undefined, { maximumFractionDigits: displayCurrency === "XAF" ? 0 : 2 })}
                       </span>
                       <span className="text-sm font-bold text-primary/80 italic uppercase">{displayCurrency}</span>
                    </div>
                 </div>
                 
                 <div className="h-10 w-px bg-white/10 hidden sm:block" />
                 
                 <div className="hidden md:block">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-0.5">Contrat</p>
                    <div className="flex items-center gap-1.5">
                       <ShieldCheck size={12} className="text-success" />
                       <span className="text-[11px] font-bold text-text-main whitespace-nowrap">Enterprise</span>
                    </div>
                 </div>
              </div>

              {/* Action Button & Trust Hint */}
              <div className="flex flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
                 <button 
                   disabled={purchaseMutation.isPending}
                   onClick={() => isCatalog ? purchaseMutation.mutate({ package_id: pkg.id, total_licenses: 10 }) : onClose()}
                   className="btn btn-primary h-12 px-10 text-xs font-black shadow-glow group relative overflow-hidden rounded-xl w-full sm:w-auto"
                 >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    {purchaseMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        {isCatalog ? "Confirmer l'Achat" : "Fermer l'Aperçu"}
                        {isCatalog && <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />}
                      </span>
                    )}
                 </button>
                 <div className="flex items-center gap-3 opacity-40">
                    <span className="text-[8px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-1">
                       <ShieldCheck size={8} /> SSL 256-bit
                    </span>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-1">
                       <Award size={8} /> Garanti
                    </span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </>
  );
}
