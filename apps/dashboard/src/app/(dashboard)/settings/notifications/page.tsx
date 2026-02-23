"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { NotificationSetting } from "@/lib/types";
import {
    Bell,
    Search,
    UserPlus,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Trash2,
    Power
} from "lucide-react";

export default function NotificationsPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch active settings
    const { data: settings = [], isLoading } = useQuery<NotificationSetting[]>({
        queryKey: ["notifications"],
        queryFn: () => adminApi.getNotifications().then((r) => r.data.data),
    });

    // Search LMS Admins
    const { data: searchResults = [] } = useQuery({
        queryKey: ["lms-admins", searchQuery],
        queryFn: () => adminApi.searchLmsAdmins(searchQuery).then((r) => r.data.data),
        enabled: searchQuery.length >= 0, // Allow empty query to show first 50
    });

    const updateMutation = useMutation({
        mutationFn: (data: Partial<NotificationSetting>) => adminApi.updateNotificationSetting(data as any),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => adminApi.deleteNotificationSetting(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        },
    });

    const handleAddAdmin = (email: string) => {
        updateMutation.mutate({
            adminEmail: email,
            notifyOnSuccess: true,
            notifyOnFailure: true,
            notifyOnSuspicious: true,
            isActive: true
        });
        setSearchQuery(""); // clear search to reset view
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-slide-up">
            <div>
                <h1 className="page-title">
                    LMS Admin <span className="gradient-text">Notifications</span>
                </h1>
                <p className="text-sm text-text-light mt-1">
                    Gérez quels administrateurs reçoivent des alertes par email pour les transactions.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* ── Active Settings List ── */}
                <div className="xl:col-span-2 space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-primary-light flex items-center justify-center">
                            <Bell size={14} className="text-primary" />
                        </div>
                        <h2 className="section-title !mb-0">Admins Configurés ({settings.length})</h2>
                    </div>

                    {isLoading ? (
                        <div className="skeleton h-48 rounded-2xl" />
                    ) : settings.length === 0 ? (
                        <div className="card p-10 text-center flex flex-col items-center">
                            <Bell size={32} className="text-text-light/30 mb-3" />
                            <p className="text-sm font-semibold text-text-main">Aucune alerte configurée</p>
                            <p className="text-xs text-text-light mt-1 max-w-sm">Recherchez un admin ci-contre pour l'ajouter à la liste de diffusion.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {settings.map((setting) => (
                                <div key={setting.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-10 h-10 rounded-xl flex flex-shrink-0 items-center justify-center font-bold text-white shadow-sm", setting.isActive ? "bg-gradient-primary" : "bg-border")}>
                                            {setting.adminEmail.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-text-main truncate">{setting.adminEmail}</p>
                                            <p className="text-xs text-text-light">
                                                ID: {setting.id} • {new Date(setting.createdAt || "").toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 border-l border-border pl-4">
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" className="accent-success" checked={setting.notifyOnSuccess}
                                                onChange={(e) => updateMutation.mutate({ adminEmail: setting.adminEmail, notifyOnSuccess: e.target.checked })} />
                                            <span className="text-xs font-semibold text-success flex items-center gap-1"><CheckCircle2 size={12} /> Succès</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" className="accent-danger" checked={setting.notifyOnFailure}
                                                onChange={(e) => updateMutation.mutate({ adminEmail: setting.adminEmail, notifyOnFailure: e.target.checked })} />
                                            <span className="text-xs font-semibold text-danger flex items-center gap-1"><XCircle size={12} /> Échec</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input type="checkbox" className="accent-warning" checked={setting.notifyOnSuspicious}
                                                onChange={(e) => updateMutation.mutate({ adminEmail: setting.adminEmail, notifyOnSuspicious: e.target.checked })} />
                                            <span className="text-xs font-semibold text-warning-dark flex items-center gap-1"><AlertTriangle size={12} /> Suspect</span>
                                        </label>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => updateMutation.mutate({ adminEmail: setting.adminEmail, isActive: !setting.isActive })}
                                            className={cn("btn text-xs px-2.5", setting.isActive ? "btn-secondary text-text-light" : "btn-primary")}
                                        >
                                            <Power size={13} />
                                        </button>
                                        <button
                                            onClick={() => deleteMutation.mutate(setting.id)}
                                            className="btn btn-ghost text-xs px-2.5 hover:text-danger hover:bg-danger-light"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── LMS Search Panel ── */}
                <div className="xl:col-span-1">
                    <div className="card p-6 sticky top-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Search size={16} className="text-text-main" />
                            <h3 className="section-title !mb-0 text-base">Recherche Admins LMS</h3>
                        </div>
                        <input
                            type="text"
                            placeholder="Rechercher par email..."
                            className="input mb-4"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                            {searchResults.map((user: any) => {
                                const isAlreadyAdded = settings.some(s => s.adminEmail === user.email);
                                return (
                                    <div key={user.id} className="flex items-center justify-between p-3 bg-background rounded-xl">
                                        <div className="min-w-0 pr-2">
                                            <p className="text-xs font-bold text-text-main truncate" title={user.email}>{user.email}</p>
                                            <p className="text-[10px] text-text-light truncate">{user.name}</p>
                                        </div>
                                        <button
                                            disabled={isAlreadyAdded || updateMutation.isPending}
                                            onClick={() => handleAddAdmin(user.email)}
                                            className={cn("p-2 rounded-lg transition-colors flex-shrink-0",
                                                isAlreadyAdded ? "bg-success-light text-success cursor-not-allowed" : "bg-primary-light text-primary hover:bg-primary hover:text-white"
                                            )}
                                            title={isAlreadyAdded ? "Déjà configuré" : "Ajouter aux alertes"}
                                        >
                                            {isAlreadyAdded ? <CheckCircle2 size={14} /> : <UserPlus size={14} />}
                                        </button>
                                    </div>
                                );
                            })}
                            {searchResults.length === 0 && (
                                <p className="text-xs text-text-light text-center py-4">Aucun utilisateur trouvé.</p>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
