"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Code,
  Rocket,
  Settings,
  Shield,
  HelpCircle,
  Menu,
  X,
  ChevronRight,
  ExternalLink,
  Database,
  Workflow,
  Mail,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", href: "/docs", icon: BookOpen },
      { title: "Architecture", href: "/docs/architecture", icon: Workflow },
      { title: "Quick Start", href: "/docs/quick-start", icon: Rocket },
    ],
  },
  {
    title: "API Reference",
    items: [
      { title: "Authentication", href: "/docs/api/auth", icon: Shield },
      { title: "Payments", href: "/docs/api/payments", icon: CreditCard },
      { title: "Webhooks", href: "/docs/api/webhooks", icon: Database },
      { title: "Admin API", href: "/docs/api/admin", icon: Settings },
    ],
  },
  {
    title: "Integration",
    items: [
      {
        title: "Frontend Guide",
        href: "/docs/integration/frontend",
        icon: Code,
      },
      {
        title: "LMS Integration",
        href: "/docs/integration/lms",
        icon: BookOpen,
      },
      {
        title: "Email Templates",
        href: "/docs/integration/emails",
        icon: Mail,
      },
    ],
  },
  {
    title: "Deployment",
    items: [
      { title: "VPS Setup", href: "/docs/deployment/vps", icon: Rocket },
      {
        title: "Environment",
        href: "/docs/deployment/environment",
        icon: Settings,
      },
      { title: "Security", href: "/docs/deployment/security", icon: Shield },
    ],
  },
  {
    title: "Maintenance",
    items: [
      {
        title: "Monitoring",
        href: "/docs/maintenance/monitoring",
        icon: Settings,
      },
      {
        title: "Troubleshooting",
        href: "/docs/maintenance/troubleshooting",
        icon: HelpCircle,
      },
      {
        title: "Updates",
        href: "/docs/maintenance/updates",
        icon: ExternalLink,
      },
    ],
  },
];

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Top navigation */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between h-16 px-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link href="/docs" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SL</span>
              </div>
              <span className="font-bold text-slate-900">Docs</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/StudiesHolding/agregateurdepaiement"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              GitHub
            </a>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
              v1.0.0
            </span>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transform transition-transform duration-200 lg:transform-none",
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0",
          )}
        >
          <nav className="h-full overflow-y-auto p-4 lg:p-6">
            {navigation.map((section, idx) => (
              <div
                key={section.title}
                className={cn("mb-6", idx === 0 && "mb-8")}
              >
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  {section.title}
                </h3>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                            isActive
                              ? "bg-primary text-white shadow-md shadow-primary/20"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                          )}
                        >
                          <item.icon
                            size={16}
                            className={
                              isActive ? "text-white" : "text-slate-400"
                            }
                          />
                          {item.title}
                          {isActive && (
                            <ChevronRight size={14} className="ml-auto" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8 lg:py-12">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
