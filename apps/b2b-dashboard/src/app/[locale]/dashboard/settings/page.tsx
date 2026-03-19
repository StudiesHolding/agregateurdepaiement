"use client";

import { useTranslations } from "next-intl";
import { Settings, Building, Shield, Bell, Save, Loader2, LogOut, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { b2bAuth } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TabType = "profile" | "security" | "notifications";

export default function SettingsPage() {
  const t = useTranslations("common");
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  // Profile form
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const { data: userData, isLoading, refetch } = useQuery({
    queryKey: ["b2b-me"],
    queryFn: async () => {
      const resp = await b2bAuth.me();
      return resp.data.data.user;
    }
  });

  // Sync form data when user loads
  useEffect(() => {
    if (userData) {
      setProfileForm({
        first_name: userData.first_name || "",
        last_name: userData.last_name || "",
        email: userData.email || "",
      });
    }
  }, [userData]);

  const profileMutation = useMutation({
    mutationFn: (data: { first_name: string; last_name: string }) =>
      b2bAuth.updateProfile(data),
    onSuccess: () => {
      toast.success("Profil mis à jour avec succès");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Erreur lors de la mise à jour");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      b2bAuth.changePassword(data),
    onSuccess: () => {
      toast.success("Mot de passe mis à jour avec succès");
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Erreur lors du changement de mot de passe");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => b2bAuth.logout(),
    onSuccess: () => {
      window.location.href = "/fr/login";
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    profileMutation.mutate(profileForm);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (passwordForm.new_password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    passwordMutation.mutate({
      current_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
    });
  };

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
          <button
            onClick={() => setActiveTab("profile")}
            className={cn(
              "flex items-center gap-3 w-full p-3 rounded-2xl font-bold text-sm text-left transition-all",
              activeTab === "profile"
                ? "bg-primary/10 text-primary border border-primary/20 shadow-glow-sm"
                : "text-text-muted hover:text-text-main hover:bg-white/5"
            )}
          >
            <Building className="h-4 w-4" />
            Mon Profil
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={cn(
              "flex items-center gap-3 w-full p-3 rounded-2xl font-bold text-sm text-left transition-all",
              activeTab === "security"
                ? "bg-primary/10 text-primary border border-primary/20 shadow-glow-sm"
                : "text-text-muted hover:text-text-main hover:bg-white/5"
            )}
          >
            <Shield className="h-4 w-4" />
            Sécurité
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={cn(
              "flex items-center gap-3 w-full p-3 rounded-2xl font-bold text-sm text-left transition-all",
              activeTab === "notifications"
                ? "bg-primary/10 text-primary border border-primary/20 shadow-glow-sm"
                : "text-text-muted hover:text-text-main hover:bg-white/5"
            )}
          >
            <Bell className="h-4 w-4" />
            Notifications
          </button>

          <div className="pt-6 mt-6 border-t border-white/5">
            <button
              onClick={() => logoutMutation.mutate()}
              className="flex items-center gap-3 w-full p-3 rounded-2xl font-bold text-sm text-left text-danger hover:bg-danger/10 transition-all"
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="card space-y-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="h-16 w-16 rounded-2xl bg-gradient-brand flex items-center justify-center text-white text-xl font-black shadow-glow border border-white/10">
                  {profileForm.first_name?.[0]}{profileForm.last_name?.[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main">{userData?.company?.name}</h3>
                  <p className="text-sm text-text-muted">Administrateur B2B</p>
                </div>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-text-muted uppercase tracking-wider">Prénom</label>
                    <input
                      type="text"
                      value={profileForm.first_name}
                      onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-text-muted uppercase tracking-wider">Nom</label>
                    <input
                      type="text"
                      value={profileForm.last_name}
                      onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-text-muted uppercase tracking-wider">Email Professionnel</label>
                  <input
                    type="email"
                    readOnly
                    value={profileForm.email}
                    className="input opacity-60 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-text-muted">L'email ne peut pas être modifié</p>
                </div>

                <div className="pt-4 border-t border-white/5 flex justify-end">
                  <button
                    type="submit"
                    disabled={profileMutation.isPending}
                    className="btn btn-primary shadow-glow"
                  >
                    {profileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Enregistrer
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="card space-y-6">
              <h3 className="text-lg font-bold text-text-main">Changer le mot de passe</h3>
              <p className="text-sm text-text-muted">Assurez-vous d'utiliser un mot de passe unique et sécurisé.</p>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-text-muted uppercase tracking-wider">Mot de passe actuel</label>
                  <div className="relative">
                    <input
                      type={showPasswords.current ? "text" : "password"}
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                      className="input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                    >
                      {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-text-muted uppercase tracking-wider">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      className="input pr-10"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                    >
                      {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-text-muted uppercase tracking-wider">Confirmer le mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      className="input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
                    >
                      {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex justify-end">
                  <button
                    type="submit"
                    disabled={passwordMutation.isPending}
                    className="btn btn-primary shadow-glow"
                  >
                    {passwordMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Shield className="h-4 w-4" />
                        Mettre à jour le mot de passe
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="card space-y-6">
              <h3 className="text-lg font-bold text-text-main">Préférences de notifications</h3>
              <p className="text-sm text-text-muted">Gérez comment vous souhaitez être notifié.</p>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-background border border-white/5">
                  <div>
                    <p className="font-semibold text-text-main">Nouvelles demandes d'accès</p>
                    <p className="text-sm text-text-muted">Recevoir une notification quand un collaborateur demande l'accès</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-background peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-background border border-white/5">
                  <div>
                    <p className="font-semibold text-text-main">Demandes traitées</p>
                    <p className="text-sm text-text-muted">Recevoir une notification quand une demande est traitée</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-background peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-background border border-white/5">
                  <div>
                    <p className="font-semibold text-text-main">Licences faibles</p>
                    <p className="text-sm text-text-muted">Recevoir une alerte quand les licences sont presque épuisées</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-background peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Danger Zone */}
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
