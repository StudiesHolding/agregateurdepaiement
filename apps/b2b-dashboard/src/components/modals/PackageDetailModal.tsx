"use client";

import { Modal } from "@/components/ui/Modal";
import { CheckCircle2, Clock, BarChart, Users, Star, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { b2bPackages } from "@/lib/api";
import { toast } from "sonner";

interface PackageDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: any;
}

export function PackageDetailModal({ isOpen, onClose, pkg }: PackageDetailModalProps) {
  const queryClient = useQueryClient();
  
  const purchaseMutation = useMutation({
    mutationFn: (data: { package_id: number; total_licenses: number }) => b2bPackages.purchase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["b2b-packages"] });
      queryClient.invalidateQueries({ queryKey: ["b2b-dashboard-stats"] });
      toast.success("Package acheté avec succès ! Retrouvez-le dans 'Mes Packages'.");
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Erreur lors de l'achat");
    }
  });

  if (!pkg) return null;

  const formations = pkg.packageFormations || pkg.package?.packageFormations || [];
  const isCatalog = !pkg.company_id;

  const handleAction = () => {
    if (isCatalog) {
      purchaseMutation.mutate({
        package_id: pkg.id,
        total_licenses: 10 // Simulated default
      });
    } else {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={pkg.title || pkg.package?.title} maxWidth="lg">
      <div className="flex flex-col space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar pr-2">
        {/* Hero Section */}
        <div className="relative h-48 w-full rounded-2xl overflow-hidden bg-surface border border-white/5 shadow-inner shrink-0">
          {pkg.image_url || pkg.package?.image_url ? (
            <img 
              src={pkg.image_url || pkg.package?.image_url} 
              alt={pkg.title || pkg.package?.title} 
              className="w-full h-full object-cover" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-transparent">
              <Users className="h-16 w-16 text-primary/20" />
            </div>
          )}
          <div className="absolute bottom-4 left-4">
            <span className="badge badge-primary shadow-glow">
              {pkg.price || pkg.package?.price} {pkg.currency || pkg.package?.currency || "XOF"}
            </span>
          </div>
        </div>

        {/* Content Section */}
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-text-main mb-3">À propos de ce package</h3>
            <p className="text-sm text-text-light leading-relaxed">
              {pkg.description || pkg.package?.description || "Aucune description disponible pour le moment."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-subtle flex items-center gap-3 p-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Contenu</p>
                <p className="text-sm font-bold text-text-main">{formations.length} formations incluses</p>
              </div>
            </div>
            <div className="card-subtle flex items-center gap-3 p-4">
              <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Public Cible</p>
                <p className="text-sm font-bold text-text-main capitalize">{pkg.target_audience || pkg.package?.target_audience || "Entreprises"}</p>
              </div>
            </div>
          </div>

          {/* Formations List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-main">Programme détaillé</h3>
              <span className="text-xs text-text-muted font-medium">{formations.length} modules</span>
            </div>
            
            <div className="space-y-4">
              {formations.map((pf: any, index: number) => {
                const course = pf.globalCourse || pf.specificCourse;
                if (!course) return null;
                
                return (
                  <div 
                    key={pf.id || index} 
                    className="group bg-gradient-to-r from-white/[0.03] to-transparent hover:from-primary/5 p-5 rounded-3xl border border-white/[0.05] transition-all duration-500 hover:shadow-glow-sm"
                  >
                    <div className="flex items-start gap-5">
                      <div className="flex-shrink-0 mt-1">
                        <div className="h-10 w-10 rounded-2xl bg-surface flex items-center justify-center text-text-muted group-hover:bg-primary/10 group-hover:text-primary transition-all duration-500 shadow-inner">
                          <span className="text-xs font-black opacity-40 group-hover:opacity-100">{(index + 1).toString().padStart(2, '0')}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-black text-text-main group-hover:text-primary transition-colors truncate tracking-tight">
                            {course.title}
                          </h4>
                          <ArrowRight className="h-4 w-4 text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500" />
                        </div>
                        <p className="mt-1 text-xs text-text-muted line-clamp-1 font-medium italic">
                          {course.post_excerpt || "Approfondissez vos connaissances avec ce module expert."}
                        </p>
                        <div className="mt-4 flex items-center gap-5">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 text-[10px] text-text-light font-bold uppercase tracking-tighter">
                            <Clock className="h-3 w-3 text-primary/60" />
                            {pf.specificCourse?.duration_hours ? `${pf.specificCourse.duration_hours}h` : "Durée variable"}
                          </div>
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 text-[10px] text-text-light font-bold uppercase tracking-tighter">
                            <BarChart className="h-3 w-3 text-warning/60" />
                            {pf.specificCourse?.difficulty_level || "Tous niveaux"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {formations.length === 0 && (
                <div className="text-center py-10 glass-dark rounded-2xl border border-dashed border-white/10">
                  <p className="text-sm text-text-muted italic">Le programme détaillé arrive prochainement.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-6 border-t border-white/5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-black text-text-main">
              {pkg.price || pkg.package?.price} {pkg.currency || pkg.package?.currency || "XOF"}
            </span>
            <span className="text-[10px] text-success font-bold uppercase">Activation immédiate</span>
          </div>
          <button 
            disabled={purchaseMutation.isPending}
            onClick={handleAction}
            className="btn btn-primary px-8 shadow-glow disabled:opacity-50"
          >
            {purchaseMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : isCatalog ? (
              "Acheter le Package"
            ) : (
              "Fermer"
            )}
            {!purchaseMutation.isPending && isCatalog && <ArrowRight className="ml-2 h-4 w-4" />}
          </button>
        </div>
      </div>
    </Modal>
  );
}
