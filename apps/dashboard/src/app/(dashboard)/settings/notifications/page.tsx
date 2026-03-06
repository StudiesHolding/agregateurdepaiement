"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { adminApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { NotificationSetting } from "@/lib/types";
import {
    Bell,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Power,
    ShieldCheck,
    Mail,
    Settings2,
    UserCircle
} from "lucide-react";

export default function NotificationsPage() {
    const queryClient = useQueryClient();
    const { data: session } = useSession();

    // Fetch ONLY current user settings
    const { data: mySetting, isLoading } = useQuery<NotificationSetting | null>({
        queryKey: ["notifications", "me"],
        queryFn: () => adminApi.getMyNotifications().then((r) => r.data.data),
    });

    const updateMutation = useMutation({
        mutationFn: (data: Partial<NotificationSetting>) => adminApi.updateNotificationSetting(data as any),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications", "me"] });
        },
    });

    const toggleActive = () => {
        if (!session?.user?.email) return;
        updateMutation.mutate({
            adminEmail: session.user.email,
            isActive: !mySetting?.isActive
        });
    };

    const handleToggle = (field: keyof NotificationSetting, value: boolean) => {
        if (!session?.user?.email) return;
        updateMutation.mutate({
            adminEmail: session.user.email,
            [field]: value
        });
    };

    const createInitialSettings = () => {
        if (!session?.user?.email) return;
        updateMutation.mutate({
            adminEmail: session.user.email,
            notifyOnSuccess: true,
            notifyOnFailure: true,
            notifyOnSuspicious: true,
            notifyOnNewOrder: true,
            notifyWithSound: true,
            isActive: true
        });
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="skeleton h-12 w-1/3 rounded-xl" />
                <div className="skeleton h-64 rounded-3xl" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-slide-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="page-title !mb-2">
                        Mes <span className="gradient-text">Préférences</span>
                    </h1>
                    <p className="text-sm text-text-light max-w-lg">
                        Personnalisez comment vous souhaitez être notifié des événements critiques sur la plateforme.
                    </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-background rounded-2xl border border-border">
                    <UserCircle size={16} className="text-primary" />
                    <span className="text-xs font-bold text-text-main">{session?.user?.email}</span>
                </div>
            </div>

            {!mySetting ? (
                <div className="card p-12 text-center flex flex-col items-center border-dashed border-2">
                    <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
                        <Bell size={32} className="text-primary animate-pulse" />
                    </div>
                    <h2 className="text-xl font-bold text-text-main mb-2">Configurez vos alertes</h2>
                    <p className="text-sm text-text-light max-w-md mb-8">
                        Vous n'avez pas encore défini de préférences de notification. Activez-les maintenant pour rester informé en temps réel.
                    </p>
                    <button
                        onClick={createInitialSettings}
                        disabled={updateMutation.isPending}
                        className="btn btn-primary btn-lg shadow-lg shadow-primary/20"
                    >
                        Activer mes notifications
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-8">
                    {/* Status Card */}
                    <div className={cn(
                        "card p-6 border-l-4 transition-all duration-500",
                        mySetting.isActive ? "border-success bg-success/5" : "border-text-light bg-background"
                    )}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
                                    mySetting.isActive ? "bg-success text-white" : "bg-border text-text-light"
                                )}>
                                    <Power size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-text-main">
                                        Service de Notification {mySetting.isActive ? "Actif" : "Inactif"}
                                    </h3>
                                    <p className="text-xs text-text-light">
                                        {mySetting.isActive
                                            ? "Vous recevrez des alertes selon vos réglages ci-dessous."
                                            : "Toutes vos notifications sont actuellement suspendues."}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={toggleActive}
                                disabled={updateMutation.isPending}
                                className={cn(
                                    "btn px-6",
                                    mySetting.isActive ? "btn-secondary text-text-light" : "btn-primary"
                                )}
                            >
                                {mySetting.isActive ? "Désactiver" : "Réactiver"}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Email Alerts Section */}
                        <div className="card p-6 space-y-6">
                            <div className="flex items-center gap-2 pb-4 border-b border-border">
                                <Mail size={18} className="text-primary" />
                                <h3 className="font-bold text-text-main">Alertes Email</h3>
                            </div>

                            <div className="space-y-4">
                                <ToggleRow
                                    label="Paiements Réussis"
                                    desc="Recevoir un email pour chaque vente validée."
                                    checked={mySetting.notifyOnSuccess}
                                    icon={<CheckCircle2 size={16} className="text-success" />}
                                    onChange={(v) => handleToggle('notifyOnSuccess', v)}
                                    disabled={!mySetting.isActive}
                                />
                                <ToggleRow
                                    label="Échecs de Paiement"
                                    desc="Être informé des abandons ou erreurs techniques."
                                    checked={mySetting.notifyOnFailure}
                                    icon={<XCircle size={16} className="text-danger" />}
                                    onChange={(v) => handleToggle('notifyOnFailure', v)}
                                    disabled={!mySetting.isActive}
                                />
                                <ToggleRow
                                    label="Activités Suspectes"
                                    desc="Alertes de sécurité et tentatives de fraude."
                                    checked={mySetting.notifyOnSuspicious}
                                    icon={<ShieldCheck size={16} className="text-warning-dark" />}
                                    onChange={(v) => handleToggle('notifyOnSuspicious', v)}
                                    disabled={!mySetting.isActive}
                                />
                            </div>
                        </div>

                        {/* Workflow & System Section */}
                        <div className="card p-6 space-y-6">
                            <div className="flex items-center gap-2 pb-4 border-b border-border">
                                <Settings2 size={18} className="text-primary" />
                                <h3 className="font-bold text-text-main">Système & Workflow</h3>
                            </div>

                            <div className="space-y-4">
                                <ToggleRow
                                    label="Validation Requise"
                                    desc="Alerte immédiate pour les nouveaux paiements LMS."
                                    checked={mySetting.notifyOnNewOrder}
                                    icon={<AlertTriangle size={16} className="text-warning-dark" />}
                                    onChange={(v) => handleToggle('notifyOnNewOrder', v)}
                                    disabled={!mySetting.isActive}
                                />
                                <ToggleRow
                                    label="Sons d'alerte"
                                    desc="Activer les signaux sonores dans le dashboard."
                                    checked={mySetting.notifyWithSound}
                                    icon={<span className="text-base">🔊</span>}
                                    onChange={(v) => handleToggle('notifyWithSound', v)}
                                    disabled={!mySetting.isActive}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

interface ToggleRowProps {
    label: string;
    desc: string;
    checked: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
    onChange: (checked: boolean) => void;
}

function ToggleRow({ label, desc, checked, disabled, icon, onChange }: ToggleRowProps) {
    return (
        <div className={cn(
            "flex items-center justify-between p-3 rounded-xl transition-colors",
            disabled ? "opacity-50 grayscale" : "hover:bg-background"
        )}>
            <div className="flex items-center gap-3 min-w-0">
                {icon && <div className="flex-shrink-0">{icon}</div>}
                <div className="min-w-0">
                    <p className="text-sm font-bold text-text-main underline decoration-primary/20 decoration-2 underline-offset-4">{label}</p>
                    <p className="text-[10px] text-text-light truncate">{desc}</p>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <div className="w-10 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary shadow-sm"></div>
            </label>
        </div>
    );
}
