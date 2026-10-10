"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Activity,
  GitBranch,
  FileText,
  ShoppingCart,
  Webhook,
  Bell,
  Users,
  ShieldCheck,
  ArrowUpRight,
  AlertTriangle,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/BrandMark";
import { useAccess, type PspPermission } from "@/lib/access";

/**
 * Navigation de l'espace finance (ADR-0019, D1) : par domaine, filtrée par les permissions `psp.*` du membre.
 * Le backend refuse de toute façon ce que le compte ne peut pas faire.
 */
type Item = { href: string; label: string; icon: LucideIcon; anyOf: PspPermission[] };
const navItems: Array<{ group: string; items: Item[] }> = [
  {
    group: "Pilotage",
    items: [
      { href: "/", label: "Centre de pilotage", icon: LayoutDashboard, anyOf: ["psp.view"] },
      { href: "/revenue", label: "Revenus", icon: BarChart3, anyOf: ["psp.view"] },
      { href: "/failures", label: "Échecs et frictions", icon: AlertTriangle, anyOf: ["psp.view"] },
      { href: "/reconciliation", label: "Rapprochement", icon: Scale, anyOf: ["psp.view"] },
    ],
  },
  {
    group: "Paiements",
    items: [
      { href: "/transactions", label: "Transactions", icon: FileText, anyOf: ["psp.view"] },
      { href: "/orders", label: "Commandes", icon: ShoppingCart, anyOf: ["psp.view"] },
      { href: "/webhooks", label: "Webhooks", icon: Webhook, anyOf: ["psp.view"] },
    ],
  },
  {
    group: "Configuration",
    items: [
      { href: "/providers", label: "Prestataires", icon: Activity, anyOf: ["psp.view"] },
      { href: "/routing", label: "Règles de priorité", icon: GitBranch, anyOf: ["psp.view"] },
      { href: "/settings/notifications", label: "Notifications", icon: Bell, anyOf: ["psp.operations.manage"] },
    ],
  },
  {
    group: "Entreprises",
    items: [{ href: "/requests", label: "Demandes d’accès", icon: Users, anyOf: ["psp.view"] }],
  },
  {
    group: "Gouvernance",
    items: [{ href: "/audit", label: "Journal d’audit", icon: ShieldCheck, anyOf: ["psp.view"] }],
  },
];

const SL_ADMIN = (process.env.NEXT_PUBLIC_SL_ADMIN_URL || "http://localhost:3004").replace(/\/$/, "");

export function Sidebar() {
  const pathname = usePathname();
  const { ready, canAny } = useAccess();
  const groups = navItems
    .map((g) => ({ ...g, items: g.items.filter((i) => ready && canAny(i.anyOf)) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border flex flex-col">
      {/* Marque */}
      <div className="h-16 px-4 flex items-center border-b border-border">
        <Link href="/" className="rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <BrandMark subtitle="Paiements" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-5 scroll-area" aria-label="Navigation principale">
        {groups.map((group) => (
          <div key={group.group}>
            <p className="px-3 mb-1.5 text-xs font-semibold text-text-light uppercase tracking-wider">{group.group}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link href={item.href} aria-current={isActive ? "page" : undefined} className={cn("sidebar-link", isActive && "active")}>
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

      {/* Retour à l'administration */}
      <div className="p-3 border-t border-border">
        <a href={`${SL_ADMIN}/admin`} className="sidebar-link justify-between">
          <span>Administration Studies Learning</span>
          <ArrowUpRight size={14} />
        </a>
      </div>
    </aside>
  );
}
