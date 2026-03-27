"use client";

import { Bell, LogOut, Loader2, Menu, X } from "lucide-react";
import { useParams } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { b2bAuth, b2bNotifications } from "@/lib/api";
import { getInitials, cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSidebar } from "@/components/providers/SidebarProvider";

export function Header() {
  const t = useTranslations("common");
  const params = useParams();
  const locale = params.locale as string || "fr";
  const { toggleMobile } = useSidebar();

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ["b2b-me"],
    queryFn: async () => {
      const response = await b2bAuth.me();
      return response.data.data.user;
    },
  });

  const { data: notificationsData } = useQuery({
    queryKey: ["b2b-notifications"],
    queryFn: async () => {
      const response = await b2bNotifications.getAll();
      return response.data.data;
    },
    refetchInterval: 60000,
  });

  const handleLogout = () => {
    localStorage.removeItem("b2b_token");
    document.cookie = "b2b_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    toast.success("Déconnexion réussie");
    window.location.href = `/${locale}/login`;
  };

  const unreadCount = notificationsData?.filter((n: any) => !n.is_read).length || 0;

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar-bg/80 backdrop-blur-2xl px-4 sm:px-8 transition-all duration-300">
      {/* Animated Top Accent - Subtler */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-brand opacity-40" />

      <div className="flex items-center gap-4 lg:gap-6">
        {/* Mobile Toggle - Improved Design */}
        <button
          onClick={toggleMobile}
          className="group flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-text-muted hover:text-primary lg:hidden transition-all duration-300 shadow-inner active:scale-90"
          aria-label="Toggle Menu"
        >
          <Menu className="h-5 w-5 group-hover:rotate-180 transition-transform duration-500" />
        </button>
        
        {/* Page Title Slot */}
        <div id="header-title" className="hidden lg:block min-w-[100px]" />
      </div>

      {/* Center: Brand or Search could go here if needed, but keeping it clean for now */}

      {/* Right side: Modern Action Group */}
      <div className="flex items-center gap-3 sm:gap-5">
        
        {/* Functional Toggles - ALWAYS VISIBLE */}
        <div className="flex items-center gap-2 pr-2 sm:pr-4 border-r border-white/10">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        {/* System Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/5 bg-white/5 text-text-muted hover:text-primary hover:bg-white/10 transition-all duration-300 shadow-sm active:scale-95"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 group-hover:rotate-12 transition-transform" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-black text-white shadow-[0_0_12px_rgba(var(--primary-rgb),0.5)] border-2 border-surface animate-bounce-subtle">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Profile - Premium Feel */}
          <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-white/10">
            <div className="hidden md:flex flex-col items-end">
              {userLoading ? (
                <div className="space-y-1">
                  <div className="h-3 w-24 bg-white/5 animate-pulse rounded-full" />
                  <div className="h-2 w-16 bg-white/5 animate-pulse rounded-full" />
                </div>
              ) : (
                <>
                  <span className="text-sm font-black text-text-main tracking-tight leading-none mb-1">
                    {userData?.first_name} {userData?.last_name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_6px_rgba(34,197,94,0.4)]" />
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-widest leading-none">
                      {userData?.role || 'Directeur'}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="group relative">
               <div className="h-11 w-11 rounded-2xl bg-gradient-brand p-[1px] shadow-glow-sm transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
                  <div className="h-full w-full rounded-[15px] bg-background flex items-center justify-center text-text-main text-xs font-black">
                    {userLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      getInitials(userData?.first_name || "Admin", userData?.last_name || "")
                    )}
                  </div>
               </div>
               
               {/* Quick Logout Mini Button overlay on profile */}
               <button
                  onClick={handleLogout}
                  className="absolute -bottom-1 -right-1 h-6 w-6 rounded-lg bg-error text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all opacity-0 group-hover:opacity-100"
                  title="Déconnexion"
                >
                  <LogOut size={12} />
               </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
