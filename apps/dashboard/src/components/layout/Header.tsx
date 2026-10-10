"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Moon, RefreshCw, Sun, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@/components/NotificationCenter";
import { PERMISSION_LABELS, ROLE_LABELS, useAccess } from "@/lib/access";

const pageTitles: Array<[string, string]> = [
    ["/providers", "Prestataires"],
    ["/routing", "Règles de priorité"],
    ["/transactions", "Transactions"],
    ["/orders", "Commandes"],
    ["/requests", "Demandes d’accès des entreprises"],
    ["/revenue", "Revenus"],
    ["/failures", "Échecs et frictions"],
    ["/webhooks", "Webhooks"],
    ["/audit", "Journal d’audit"],
    ["/settings/notifications", "Notifications"],
];

interface HeaderProps {
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

const initials = (name: string) => name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "SL";

export function Header({ onRefresh, isRefreshing }: HeaderProps) {
    const pathname = usePathname();
    const { resolvedTheme, setTheme } = useTheme();
    const { user, permissions } = useAccess();
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const title = pathname === "/" ? "Centre de pilotage" : pageTitles.find(([p]) => pathname.startsWith(p))?.[1] ?? "Studies Learning · Paiements";
    const name = user?.name || user?.email || "Membre de l’équipe";

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(false); };
        const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", esc);
        return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
    }, [open]);

    const formattedDate = new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    return (
        <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-border px-6 h-16 flex items-center justify-between">
            <div>
                <h1 className="text-lg font-bold text-text-main">{title}</h1>
                <p className="text-xs text-text-light capitalize">{formattedDate}</p>
            </div>

            <div className="flex items-center gap-2">
                {onRefresh && (
                    <button onClick={onRefresh} className={cn("btn-ghost p-2 rounded-xl", isRefreshing && "animate-spin")} title="Actualiser les données" aria-label="Actualiser les données">
                        <RefreshCw size={16} />
                    </button>
                )}

                <button
                    onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                    className="btn-ghost p-2 rounded-xl"
                    title="Changer de thème"
                    aria-label="Changer de thème"
                >
                    <Sun size={16} className="hidden dark:block text-warning" />
                    <Moon size={16} className="block dark:hidden" />
                </button>

                <NotificationCenter />

                {/* Membre connecté */}
                <div className="relative pl-2 border-l border-border" ref={menuRef}>
                    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-xl p-1 hover:bg-background">
                        <span className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center text-white text-xs font-bold shadow-glow">{initials(name)}</span>
                        <span className="hidden md:block text-left">
                            <span className="block text-xs font-semibold text-text-main max-w-[160px] truncate">{name}</span>
                            <span className="block text-xs text-text-light">{ROLE_LABELS[user?.role ?? ""] ?? "Équipe"}</span>
                        </span>
                    </button>
                    {open && (
                        <div role="menu" className="absolute right-0 mt-2 w-72 card p-4 shadow-card-hover animate-fade-in">
                            <p className="text-sm font-semibold text-text-main truncate">{name}</p>
                            {user?.email && <p className="text-xs text-text-light truncate">{user.email}</p>}
                            <p className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-light">Vos droits sur l’agrégateur</p>
                            <ul className="space-y-1">
                                {permissions.map((p) => (
                                    <li key={p} className="flex items-center gap-2 text-xs text-text-main"><ShieldCheck size={13} className="text-success" />{PERMISSION_LABELS[p] ?? p}</li>
                                ))}
                            </ul>
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => signOut({ callbackUrl: "/login" })}
                                className="mt-4 w-full btn-secondary justify-center text-xs"
                            >
                                <LogOut size={14} /> Se déconnecter
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
