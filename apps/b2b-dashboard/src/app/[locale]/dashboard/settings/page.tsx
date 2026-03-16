"use client";

import { useTranslations } from "next-intl";
import { Settings, Building, Shield, Bell, Save, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { b2bAuth } from "@/lib/api";
import { toast } from "sonner";

export default function SettingsPage() {
  const t = useTranslations("common");
  
  const { data: userData, isLoading } = useQuery({
    queryKey: ["b2b-me"],
    queryFn: async () => {
      const resp = await b2bAuth.me();
      return resp.data.data.user;
    }
  });

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
  });

  // Partial effect to sync form data once user is loaded
  useState(() => {
    if (userData) {
      setFormData({
        first_name: userData.first_name || "",
        last_name: userData.last_name || "",
        email: userData.email || "",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-text-main tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-text-light">Gérez vos informations personnelles et celles de votre entreprise.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Navigation Tabs */}
        <div className="space-y-1">
          <button className="flex items-center gap-3 w-full p-3 rounded-2xl bg-primary/10 text-primary font-bold text-sm text-left border border-primary/20 shadow-glow-sm">
            <Building className="h-4 w-4" />
            Mon Profil
          </button>
          <button className="flex items-center gap-3 w-full p-3 rounded-2xl text-text-muted hover:text-text-main hover:bg-white/5 font-medium text-sm text-left transition-all">
            <Shield className="h-4 w-4" />
            Sécurité
          </button>
          <button className="flex items-center gap-3 w-full p-3 rounded-2xl text-text-muted hover:text-text-main hover:bg-white/5 font-medium text-sm text-left transition-all">
            <Bell className="h-4 w-4" />
            Notifications
          </button>
        </div>

        {/* Content */}
        <div className="md:col-span-2 space-y-6">
          <div className="card space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="h-16 w-16 rounded-2xl bg-gradient-brand flex items-center justify-center text-white text-xl font-black shadow-glow border border-white/10">
                {userData?.first_name?.[0]}{userData?.last_name?.[0]}
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-main">{userData?.company?.name}</h3>
                <p className="text-sm text-text-muted">Administrateur B2B</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-text-muted uppercase tracking-wider">Prénom</label>
                <input 
                  type="text" 
                  defaultValue={userData?.first_name}
                  className="input" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-text-muted uppercase tracking-wider">Nom</label>
                <input 
                  type="text" 
                  defaultValue={userData?.last_name}
                  className="input" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-text-muted uppercase tracking-wider">Email Professionnel</label>
              <input 
                type="email" 
                readOnly
                defaultValue={userData?.email}
                className="input opacity-60 cursor-not-allowed" 
              />
            </div>

            <div className="pt-4 border-t border-white/5 flex justify-end">
              <button className="btn btn-primary shadow-glow">
                <Save className="h-4 w-4" />
                Enregistrer les modifications
              </button>
            </div>
          </div>
          
          <div className="card border-danger/20 bg-danger/5">
             <h3 className="text-lg font-bold text-danger mb-2">Zone de danger</h3>
             <p className="text-sm text-text-light mb-4 text-balance">Les actions ci-dessous sont irréversibles et peuvent impacter l'accès de vos collaborateurs aux formations.</p>
             <button className="btn btn-ghost text-danger border border-danger/20 hover:bg-danger/10">
               Suspendre le compte entreprise
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
