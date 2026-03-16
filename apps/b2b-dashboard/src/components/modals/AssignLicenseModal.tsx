"use client";

import { Modal } from "@/components/ui/Modal";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { b2bEmployees, b2bLicenses } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Search, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AssignLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageId?: number | string;
  packageName?: string;
}

export function AssignLicenseModal({ isOpen, onClose, packageId, packageName }: AssignLicenseModalProps) {
  const t = useTranslations("packages");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | string | null>(null);

  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["b2b-employees"],
    queryFn: async () => {
      const response = await b2bEmployees.getAll();
      return response.data.data;
    },
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: (data: { employee_id: number | string; company_package_id: number | string }) => 
      b2bLicenses.assign({
        employee_id: Number(data.employee_id),
        company_package_id: Number(data.company_package_id),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["b2b-packages"] });
      queryClient.invalidateQueries({ queryKey: ["b2b-dashboard-stats"] });
      toast.success("Licence attribuée avec succès");
      onClose();
      setSelectedEmployeeId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Erreur lors de l'attribution");
    },
  });

  const filteredEmployees = (employees || []).filter((emp: any) => 
    `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    emp.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = () => {
    if (!selectedEmployeeId || !packageId) return;
    mutation.mutate({
      employee_id: selectedEmployeeId,
      company_package_id: packageId,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("assignLicense")}>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-text-light mb-1">Attribuer une licence pour :</p>
          <p className="text-base font-bold text-primary">{packageName}</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Rechercher un collaborateur..."
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar pr-1">
          {employeesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredEmployees.length > 0 ? (
            filteredEmployees.map((emp: any) => (
              <button
                key={emp.id}
                onClick={() => setSelectedEmployeeId(emp.id)}
                className={cn(
                  "flex items-center gap-3 w-full p-3 rounded-2xl border transition-all text-left",
                  selectedEmployeeId === emp.id 
                    ? "bg-primary/10 border-primary shadow-glow-sm" 
                    : "bg-background border-white/5 hover:bg-white/5"
                )}
              >
                <div className="h-10 w-10 rounded-xl bg-surface flex items-center justify-center text-text-muted">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text-main truncate">{emp.first_name} {emp.last_name}</p>
                  <p className="text-xs text-text-muted truncate">{emp.email}</p>
                </div>
              </button>
            ))
          ) : (
            <p className="text-center py-8 text-sm text-text-muted">Aucun collaborateur trouvé.</p>
          )}
        </div>

        <div className="pt-4 flex gap-3">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            Annuler
          </button>
          <button
            disabled={!selectedEmployeeId || mutation.isPending}
            onClick={handleAssign}
            className="btn btn-primary flex-1"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Attribuer"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
