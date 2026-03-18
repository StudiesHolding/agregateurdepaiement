"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Map,
  PlusCircle,
  FileText,
  Webhook,
  Settings,
  Zap,
  ShieldCheck,
  Bell,
  ShoppingCart,
  Building2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    group: "Vue d'ensemble",
    items: [{ href: "/", label: "Command Center", icon: LayoutDashboard }],
  },
  {
    group: "Providers",
    items: [
      { href: "/providers", label: "Provider Health", icon: Activity },
      { href: "/routing", label: "Route Builder", icon: Map },
      { href: "/providers/new", label: "Provider Studio", icon: PlusCircle },
    ],
  },
  {
    group: "Données",
    items: [
      { href: "/transactions", label: "Transactions", icon: FileText },
      { href: "/orders", label: "Commandes LMS", icon: ShoppingCart },
      { href: "/requests", label: "Demandes Accès B2B", icon: Users },
      { href: "/analytics", label: "Analytics LMS", icon: Zap },
      { href: "/webhooks", label: "Webhooks", icon: Webhook },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/audit", label: "Journal d'Audit", icon: ShieldCheck },
      { href: "/settings/notifications", label: "Notifications", icon: Bell },
      { href: "/test-order", label: "Test Commande", icon: ShoppingCart },
      { href: "/test-b2b", label: "Test B2B", icon: Building2 },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-border flex flex-col">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-text-main leading-tight">
            Studies PSP
          </p>
          <p className="text-xs text-text-light">Payment Operations</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-5 scroll-area">
        {navItems.map((group) => (
          <div key={group.group}>
            <p className="px-3 mb-1.5 text-xs font-semibold text-text-light uppercase tracking-wider">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn("sidebar-link", isActive && "active")}
                    >
                      <item.icon size={16} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-text-light text-center">
          Studies Learning — PSP v1.0
        </p>
      </div>
    </aside>
  );
}
