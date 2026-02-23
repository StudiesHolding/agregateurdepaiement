"use client";

import { Bell, RefreshCw, Moon, Sun, Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslation } from "@/components/providers/I18nProvider";
import { cn } from "@/lib/utils";

const pageTitles: Record<string, string> = {
    "/": "Command Center",
    "/providers": "Provider Health Studio",
    "/routing": "Route Builder",
    "/providers/new": "Provider Studio",
    "/transactions": "Transaction Explorer",
    "/analytics": "Analytics LMS",
    "/webhooks": "Webhook Monitor",
    "/audit": "Journal d'Audit",
    "/settings": "Paramètres",
};

interface HeaderProps {
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

export function Header({ onRefresh, isRefreshing }: HeaderProps) {
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const { language, setLanguage, t } = useTranslation();
    const title = pageTitles[pathname] ?? "Dashboard";
    const now = new Date();

    const formattedDate = now.toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return (
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-border px-6 h-16 flex items-center justify-between">
            {/* Title + Date */}
            <div>
                <h1 className="text-lg font-bold text-text-main">{title}</h1>
                <p className="text-xs text-text-light capitalize">{formattedDate}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {/* Refresh */}
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        className={cn(
                            "btn-ghost p-2 rounded-xl",
                            isRefreshing && "animate-spin"
                        )}
                        title="Actualiser les données"
                    >
                        <RefreshCw size={16} />
                    </button>
                )}

                {/* Theme Toggle */}
                <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="btn-ghost p-2 rounded-xl"
                    title={t("header.theme.toggle" as any)}
                >
                    <Sun size={16} className="hidden dark:block text-warning" />
                    <Moon size={16} className="block dark:hidden" />
                </button>

                {/* Language Toggle */}
                <button
                    onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
                    className="btn-ghost p-1.5 px-2 rounded-xl flex items-center gap-1.5 font-semibold text-xs transition-colors"
                    title={t("header.lang.toggle" as any)}
                >
                    <Languages size={14} className="text-secondary" />
                    {language.toUpperCase()}
                </button>

                {/* Alerts placeholder */}
                <button className="btn-ghost p-2 rounded-xl relative" title={t("header.alerts" as any)}>
                    <Bell size={16} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger" />
                </button>

                {/* Admin badge */}
                <div className="flex items-center gap-2 pl-2 border-l border-border">
                    <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center text-white text-xs font-bold shadow-glow">
                        A
                    </div>
                    <div className="hidden md:block">
                        <p className="text-xs font-semibold text-text-main">Admin</p>
                        <p className="text-xs text-text-light">Super Admin</p>
                    </div>
                </div>
            </div>
        </header>
    );
}
