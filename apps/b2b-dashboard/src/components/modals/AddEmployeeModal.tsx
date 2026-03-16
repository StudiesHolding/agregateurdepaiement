"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { b2bEmployees } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddEmployeeModal({ isOpen, onClose }: AddEmployeeModalProps) {
  const t = useTranslations("team");
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    department: "",
    position: "",
  });

  const mutation = useMutation({
    mutationFn: (data: typeof formData) => b2bEmployees.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["b2b-employees"] });
      toast.success("Collaborateur ajouté avec succès");
      onClose();
      setFormData({ first_name: "", last_name: "", email: "", department: "", position: "" });
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || "Une erreur est survenue";
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("addEmployee")}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-light">Prénom</label>
            <input
              required
              type="text"
              className="input"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-light">Nom</label>
            <input
              required
              type="text"
              className="input"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-text-light">Email</label>
          <input
            required
            type="email"
            className="input"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-text-light">Département</label>
          <input
            type="text"
            className="input"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-text-light">Poste</label>
          <input
            type="text"
            className="input"
            value={formData.position}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
          />
        </div>

        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary flex-1"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn btn-primary flex-1"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
