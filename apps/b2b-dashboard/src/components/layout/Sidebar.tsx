"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Package,
  Users,
  FileCheck,
  History,
  Settings,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/providers/SidebarProvider";

const navItems = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "catalog", href: "/dashboard/catalog", icon: Search },
  { key: "packages", href: "/dashboard/packages", icon: Package },
  { key: "team", href: "/dashboard/team", icon: Users },
  { key: "requests", href: "/dashboard/requests", icon: FileCheck },
  { key: "history", href: "/dashboard/history", icon: History },
  { key: "settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("nav");
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="text-sm font-bold text-text-main leading-tight truncate">
                Studies Learning
              </h1>
              <p className="text-xs text-text-muted truncate">Espace Entreprise</p>
            </div>
          )}
        </div>
        
        {mobileOpen && (
          <button 
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2 text-text-muted hover:text-text-main transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const href = `/${locale}${item.href}`;
          const isActive =
            pathname === href ||
            (item.href !== "/dashboard" && pathname.startsWith(href));

          return (
            <Link
              key={item.key}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                isActive
                  ? "bg-sidebar-active text-sidebar-text-active shadow-sm"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-text-main"
              )}
              title={(collapsed && !mobileOpen) ? t(item.key) : undefined}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-colors",
                  isActive
                    ? "text-sidebar-text-active"
                    : "text-text-muted group-hover:text-text-light"
                )}
              />
              {(!collapsed || mobileOpen) && (
                <span className="animate-fade-in truncate">{t(item.key)}</span>
              )}
              {isActive && (!collapsed || mobileOpen) && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-fade-in" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle (hidden on mobile) */}
      <div className="hidden lg:block px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={toggleCollapsed}
          className="flex w-full items-center justify-center rounded-xl p-2 text-text-muted hover:text-text-main hover:bg-sidebar-hover transition-all duration-200"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen bg-sidebar-bg border-r border-sidebar-border transition-all duration-300 ease-in-out z-30",
          collapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      <div 
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-[280px] bg-sidebar-bg border-r border-sidebar-border z-50 lg:hidden transition-transform duration-300 ease-in-out flex flex-col",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
