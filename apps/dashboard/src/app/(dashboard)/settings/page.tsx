"use client";

import { Settings, Shield, Bell, Database, Globe, Lock, Cpu, Save, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

function SettingItem({ title, description, icon: Icon, children }: { title: string; description: string; icon: any; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between p-6 hover:bg-background/50 transition-colors">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center">
                    <Icon size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-text-main">{title}</h3>
                    <p className="text-xs text-text-light">{description}</p>
                </div>
            </div>
            <div>{children}</div>
        </div>
    );
}

export default function SettingsPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-slide-up">
            {/* Header */}
            <div>
                <h1 className="page-title">
                    Paramètres <span className="gradient-text">Système</span>
                </h1>
                <p className="text-sm text-text-light mt-1">
                    Configuration globale de votre passerelle de paiement
                </p>
            </div>

            {/* Sections */}
            <div className="space-y-8">
                {/* Security Section */}
                <section className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-background/30 flex items-center gap-2">
                        <Lock size={16} className="text-primary" />
                        <h2 className="text-sm font-bold text-text-main">Sécurité & API</h2>
                    </div>
                    <div className="divide-y divide-border/50">
                        <SettingItem
                            title="Webhook Signature"
                            description="Vérifier systématiquement l'authenticité des notifications reçues."
                            icon={Shield}
                        >
                            <div className="w-12 h-6 rounded-full bg-success relative cursor-pointer">
                                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                            </div>
                        </SettingItem>
                        <SettingItem
                            title="Audit Logging"
                            description="Niveau de verbosité des journaux d'audit administrateur."
                            icon={Database}
                        >
                            <select className="input text-xs w-40">
                                <option>Full (Recommandé)</option>
                                <option>Minimal</option>
                                <option>Errors only</option>
                            </select>
                        </SettingItem>
                        <SettingItem
                            title="IP Whitelisting"
                            description="Restreindre l'accès au dashboard à des adresses IP spécifiques."
                            icon={Globe}
                        >
                            <button className="btn-secondary text-[10px] px-3 py-1.5 h-auto">Configurer</button>
                        </SettingItem>
                    </div>
                </section>

                {/* System Section */}
                <section className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-background/30 flex items-center gap-2">
                        <Cpu size={16} className="text-primary" />
                        <h2 className="text-sm font-bold text-text-main">Performance & Engine</h2>
                    </div>
                    <div className="divide-y divide-border/50">
                        <SettingItem
                            title="Cache des Stats"
                            description="Intervalle de rafraîchissement du cache de performance (CRON)."
                            icon={Save}
                        >
                            <select className="input text-xs w-40">
                                <option>5 minutes</option>
                                <option>15 minutes</option>
                                <option>1 heure</option>
                            </select>
                        </SettingItem>
                        <SettingItem
                            title="Automatic Failover"
                            description="Basculer automatiquement entre les providers en cas d'échec."
                            icon={Activity}
                        >
                            <div className="w-12 h-6 rounded-full bg-success relative cursor-pointer">
                                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                            </div>
                        </SettingItem>
                    </div>
                </section>

                {/* Notifications */}
                <section className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-background/30 flex items-center gap-2">
                        <Bell size={16} className="text-primary" />
                        <h2 className="text-sm font-bold text-text-main">Notifications Alertes</h2>
                    </div>
                    <div className="divide-y divide-border/50">
                        <SettingItem
                            title="Critical Failure Email"
                            description="Alerter immédiatement si 100% des providers échouent."
                            icon={Bell}
                        >
                            <div className="w-12 h-6 rounded-full bg-success relative cursor-pointer">
                                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                            </div>
                        </SettingItem>
                    </div>
                </section>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <button className="btn-secondary">Réinitialiser</button>
                <button className="btn-primary gap-2">
                    <Save size={16} />
                    Enregistrer les modifications
                </button>
            </div>
        </div>
    );
}
