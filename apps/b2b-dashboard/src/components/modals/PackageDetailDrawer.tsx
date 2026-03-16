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
  ShoppingBag
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
  const [expandedCurriculum, setExpandedCurriculum] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
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
  const totalPrice = (pkg.price || pkg.package?.price || 0);

  return (
    <>
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 z-50 bg-background/40 backdrop-blur-sm transition-opacity duration-500",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Slide-Over Panel */}
      <div 
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full md:w-[500px] lg:w-[600px] bg-surface border-l border-white/5 shadow-[-20px_0_50px_rgba(0,0,0,0.3)] transition-transform duration-700 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Animated Gradient Top Border */}
        <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-primary animate-gradient-x" />

        {/* Header - Always Visible */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-surface/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
             <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Zap className="h-5 w-5" />
             </div>
             <div>
                <h2 className="text-lg font-black text-text-main tracking-tight line-clamp-1">
                   {pkg.title || pkg.package?.title}
                </h2>
                <div className="flex items-center gap-2">
                   <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                   <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Disponible Immédiatement</span>
                </div>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 text-text-muted hover:text-text-main hover:bg-white/10 transition-all active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10 pb-32">
          
          {/* Visual Hero */}
          <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/5 shadow-2xl group">
            {pkg.image_url || pkg.package?.image_url ? (
              <img 
                src={pkg.image_url || pkg.package?.image_url} 
                alt="Package" 
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
              />
            ) : (
              <div className="w-full h-full bg-gradient-brand flex items-center justify-center">
                 <Star className="h-16 w-16 text-white/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
               <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-8 w-8 rounded-full border-2 border-surface bg-background flex items-center justify-center overflow-hidden">
                       <img src={`https://i.pravatar.cc/150?u=${i+10}`} alt="User" />
                    </div>
                  ))}
                  <div className="h-8 w-8 rounded-full border-2 border-surface bg-primary flex items-center justify-center text-[10px] font-bold text-white">
                     +1k
                  </div>
               </div>
               <span className="text-[10px] font-black text-white/70 uppercase tracking-tighter bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                  Prisé par les entreprises
               </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
             <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center flex flex-col items-center justify-center gap-1 group hover:bg-white/[0.05] transition-colors">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-xs font-black text-text-main">40h+</span>
                <span className="text-[9px] font-bold text-text-muted uppercase">Contenu</span>
             </div>
             <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center flex flex-col items-center justify-center gap-1 group hover:bg-white/[0.05] transition-colors">
                <Award className="h-4 w-4 text-warning" />
                <span className="text-xs font-black text-text-main">Certifié</span>
                <span className="text-[9px] font-bold text-text-muted uppercase">Badge</span>
             </div>
             <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center flex flex-col items-center justify-center gap-1 group hover:bg-white/[0.05] transition-colors">
                <Users className="h-4 w-4 text-success" />
                <span className="text-xs font-black text-text-main">B2B</span>
                <span className="text-[9px] font-bold text-text-muted uppercase">Public</span>
             </div>
          </div>

          {/* About Section */}
          <section className="space-y-4">
            <h3 className="text-md font-black text-text-main uppercase tracking-widest flex items-center gap-2">
               <div className="h-1 w-6 bg-primary rounded-full" />
               Introduction
            </h3>
            <p className="text-sm text-text-light leading-relaxed font-secondary italic">
              {pkg.description || pkg.package?.description || "Une expérience de formation premium conçue pour propulser vos talents vers l'excellence technique et stratégique."}
            </p>
          </section>

          {/* Benefits */}
          <section className="p-6 rounded-3xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/10 space-y-4">
             <h4 className="text-xs font-black text-primary uppercase tracking-widest">Inclus dans votre accès B2B</h4>
             <ul className="space-y-3">
                {[
                  "Tableau de bord de suivi admin personnalisé",
                  "Assignation de licences en un clic",
                  "Support technique prioritaire 24/7",
                  "Mises à jour des contenus à vie"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-xs text-text-main font-medium">
                     <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                     {item}
                  </li>
                ))}
             </ul>
          </section>

          {/* Curriculum Accordion */}
          <section className="space-y-4">
            <button 
              onClick={() => setExpandedCurriculum(!expandedCurriculum)}
              className="flex items-center justify-between w-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all"
            >
              <h3 className="text-md font-black text-text-main uppercase tracking-widest">Programme Complet</h3>
              <ChevronDown className={cn("h-5 w-5 text-text-muted transition-transform duration-300", expandedCurriculum && "rotate-180")} />
            </button>
            
            <div className={cn(
               "space-y-3 overflow-hidden transition-all duration-500",
               expandedCurriculum ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
            )}>
              {formations.map((pf: any, index: number) => {
                const course = pf.globalCourse || pf.specificCourse;
                if (!course) return null;
                
                return (
                  <div 
                    key={pf.id || index} 
                    className="group bg-surface hover:bg-white/[0.02] p-4 rounded-2xl border border-white/[0.03] hover:border-white/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center text-text-muted text-[10px] font-black group-hover:text-primary transition-colors">
                        {(index + 1).toString().padStart(2, '0')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-text-main group-hover:text-primary transition-colors truncate">
                          {course.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 opacity-60">
                           <span className="text-[10px] font-medium uppercase tracking-tighter flex items-center gap-1">
                              <Clock className="h-3 w-3" /> 4h
                           </span>
                           <span className="text-[10px] font-medium uppercase tracking-tighter flex items-center gap-1">
                              <BarChart className="h-3 w-3" /> Expert
                           </span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-text-muted opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Global Floating Footer - ALWAYS VISIBLE */}
        <div className="p-6 border-t border-white/5 bg-surface/90 backdrop-blur-xl absolute bottom-0 left-0 right-0 z-20">
           <div className="flex items-center justify-between gap-6 max-w-2xl mx-auto">
              <div>
                 <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Prix Enterprise</p>
                 <div className="flex items-baseline gap-1">
                   <span className="text-3xl font-black text-text-main tracking-tighter">{totalPrice.toLocaleString()}</span>
                   <span className="text-sm font-bold text-primary uppercase">XOF</span>
                 </div>
              </div>

              <div className="flex-1 flex gap-3">
                 <button 
                   disabled={purchaseMutation.isPending}
                   onClick={() => isCatalog ? purchaseMutation.mutate({ package_id: pkg.id, total_licenses: 10 }) : onClose()}
                   className="btn btn-primary flex-1 py-4 text-sm font-black shadow-glow group relative overflow-hidden h-14"
                 >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    {purchaseMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        {isCatalog ? (
                          <>
                            <ShoppingBag className="h-5 w-5" />
                            Acheter Maintenant
                          </>
                        ) : (
                          "Fermer les détails"
                        )}
                      </span>
                    )}
                 </button>
              </div>
           </div>
           {isCatalog && (
             <p className="text-[9px] text-center text-text-muted mt-4 font-bold uppercase tracking-widest opacity-40">
                Activation sécurisée par cryptage 256 bits
             </p>
           )}
        </div>
      </div>
    </>
  );
}
