"use client";

import { useTranslations } from "next-intl";
import {
  Plus,
  Search,
  Mail,
  Briefcase,
  Key,
  Edit2,
  Trash2,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { cn, getInitials } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { b2bEmployees } from "@/lib/api";
import { AddEmployeeModal } from "@/components/modals/AddEmployeeModal";
import { toast } from "sonner";

const avatarColors = [
  "from-primary to-primary-400",
  "from-secondary to-blue-400",
  "from-success to-emerald-400",
  "from-warning to-amber-400",
  "from-danger to-rose-400",
  "from-purple-500 to-pink-400",
];

export default function TeamPage() {
  const t = useTranslations("team");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data: employees, isLoading, error } = useQuery({
    queryKey: ["b2b-employees"],
    queryFn: async () => {
      const response = await b2bEmployees.getAll();
      return response.data.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => b2bEmployees.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["b2b-employees"] });
      toast.success("Collaborateur supprimé");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Erreur lors de la suppression");
    }
  });

  const filtered = (employees || []).filter(
    (emp: any) =>
      emp.first_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.last_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase()) ||
      (emp.department &&
        emp.department.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDelete = (id: string | number) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce collaborateur ?")) {
      deleteMutation.mutate(Number(id));
    }
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
      <div className="flex items-center justify-between">
        <div id="header-title-content">
          <h1 className="text-2xl font-bold text-text-main tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-text-light">{t("subtitle")}</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="btn btn-primary shadow-glow"
        >
          <Plus className="h-5 w-5" />
          {t("addEmployee")}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-text-muted" />
        <input
          type="text"
          placeholder={tCommon("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-11 shadow-sm"
        />
      </div>

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((emp: any, index: number) => (
          <div
            key={emp.id}
            className="card group animate-slide-up hover:scale-[1.01] transition-all duration-300"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white text-base font-bold shadow-glow-sm",
                    avatarColors[index % avatarColors.length]
                  )}
                >
                  {getInitials(emp.first_name, emp.last_name)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-text-main truncate">
                    {emp.first_name} {emp.last_name}
                  </h3>
                  <p className="text-xs text-text-light flex items-center gap-1.5 truncate mt-0.5">
                    <Mail className="h-3.5 w-3.5 text-text-muted" />
                    {emp.email}
                  </p>
                </div>
              </div>

              <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 rounded-xl text-text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => handleDelete(emp.id)}
                  disabled={deleteMutation.isPending}
                  className="p-2 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {emp.department && (
                <span className="flex items-center gap-1.5 badge bg-primary/10 text-primary border-primary/20 font-semibold py-1 px-3">
                  <Briefcase className="h-3.5 w-3.5" />
                  {emp.department}
                </span>
              )}
              {emp.position && (
                <span className="text-xs font-medium text-text-muted bg-background px-3 py-1 rounded-full border border-white/5">
                  {emp.position}
                </span>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-text-muted">
                <Key className="h-4 w-4 text-primary/70" />
                <span className="text-xs font-semibold">
                  {emp.licenses || 0} <span className="text-text-light font-normal">{t("licensesAssigned").toLowerCase()}</span>
                </span>
              </div>
              <button className="text-xs font-bold text-primary hover:text-primary-700 hover:underline transition-all">
                {t("editEmployee")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-center glass-dark rounded-3xl border border-white/5 animate-fade-in">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-6 shadow-glow-sm">
            <Search className="h-10 w-10" />
          </div>
          <h3 className="text-lg font-bold text-text-main">{t("noEmployees")}</h3>
          <p className="text-sm text-text-light max-w-xs mt-2">Nous n'avons trouvé aucun collaborateur correspondant à votre recherche.</p>
        </div>
      )}

      <AddEmployeeModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  );
}

