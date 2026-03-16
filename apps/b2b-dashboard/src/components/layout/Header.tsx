"use client";

import { Bell, LogOut, Loader2, Menu, X } from "lucide-react";
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
    // We can fetch this less frequently or on interval
    refetchInterval: 60000,
  });

  const handleLogout = () => {
    localStorage.removeItem("b2b_token");
    toast.success("Déconnexion réussie");
    window.location.href = "/fr/login";
  };

  const unreadCount = notificationsData?.filter((n: any) => !n.is_read).length || 0;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/5 bg-surface/80 backdrop-blur-xl px-4 sm:px-6">
      <div className="flex items-center gap-4">
        {/* Mobile Toggle */}
        <button
          onClick={toggleMobile}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-surface text-text-light hover:text-text-main lg:hidden transition-all duration-300 shadow-sm"
          aria-label="Toggle Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        
        {/* Left: page title slot - filled by page */}
        <div id="header-title" className="hidden sm:block" />
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden xs:flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        {/* Notifications bell */}
        <button
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-surface text-text-light hover:text-text-main hover:bg-background transition-all duration-300 shadow-sm"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-danger text-[10px] font-black text-white shadow-glow-sm">
              {unreadCount}
            </span>
          )}
        </button>

        {/* User Info & Logout */}
        <div className="flex items-center gap-2 sm:gap-3 ml-1 sm:ml-2 pl-2 sm:pl-4 border-l border-white/5">
          <div className="flex flex-col items-end mr-1 hidden md:flex">
            {userLoading ? (
              <div className="h-4 w-20 bg-background animate-pulse rounded" />
            ) : (
              <>
                <span className="text-sm font-bold text-text-main truncate max-w-[150px]">
                  {userData?.first_name} {userData?.last_name}
                </span>
                <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">
                  {userData?.role || 'Admin'}
                </span>
              </>
            )}
          </div>
          
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white text-xs font-black shadow-glow-sm border border-white/10">
            {userLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              getInitials(userData?.first_name || "Admin", userData?.last_name || "")
            )}
          </div>

          <button
            onClick={handleLogout}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 transition-all duration-300"
            title="Se déconnecter"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
