"use client";

import Link from "next/link";
import { 
  ArrowRight, 
  CreditCard, 
  Shield, 
  Rocket,
  Database,
  Workflow,
  Code,
  Mail,
  Settings,
  CheckCircle2,
  Globe,
  Lock,
  Zap
} from "lucide-react";

const features = [
  {
    icon: CreditCard,
    title: "Multi-Provider Support",
    description: "Stripe, CinetPay, KKiaPay with automatic failover"
  },
  {
    icon: Workflow,
    title: "Order Workflow",
    description: "Complete lifecycle: pending → confirmed → validated → completed"
  },
  {
    icon: Shield,
    title: "Secure Payments",
    description: "PCI-DSS compliant, webhook signature validation"
  },
  {
    icon: Database,
    title: "Full Audit Trail",
    description: "Complete tracking with admin and order audit logs"
  },
  {
    icon: Mail,
    title: "Email Notifications",
    description: "Automated transactional emails with PDF invoices"
  },
  {
    icon: Settings,
    title: "Admin Dashboard",
    description: "Real-time KPIs, order management, provider configuration"
  }
];

const quickLinks = [
  {
    title: "API Reference",
    description: "Complete API documentation with examples",
    href: "/docs/api/payments",
    icon: Code
  },
  {
    title: "Quick Start",
    description: "Get started in 5 minutes",
    href: "/docs/quick-start",
    icon: Rocket
  },
  {
    title: "Deployment",
    description: "Deploy to production VPS",
    href: "/docs/deployment/vps",
    icon: Globe
  }
];

export default function DocsPage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
          <Zap size={16} />
          <span>Payment Aggregator v1.0.0</span>
        </div>
        <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
          Studies Learning
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            Payment Documentation
          </span>
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Complete technical documentation for integrating and managing the payment aggregator. 
          Built for developers, by developers.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <Link href="/docs/quick-start" className="btn btn-primary px-6 py-3 shadow-lg shadow-primary/25">
            Get Started <ArrowRight size={18} className="ml-2" />
          </Link>
          <Link href="/docs/api/payments" className="btn btn-secondary px-6 py-3">
            API Reference
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, idx) => (
          <div 
            key={feature.title}
            className="group p-6 bg-white rounded-2xl border border-slate-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <feature.icon size={24} className="text-primary" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-start gap-4 p-6 bg-white rounded-2xl border border-slate-200 hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <link.icon size={20} className="text-slate-600 group-hover:text-primary transition-colors" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">{link.title}</h3>
              <p className="text-sm text-slate-500">{link.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Architecture Overview */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 lg:p-12 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Workflow size={24} className="text-primary" />
            System Architecture
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-bold">1</div>
                <span className="text-slate-300">Client initiates payment</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-bold">2</div>
                <span className="text-slate-300">Backend creates Order + PaymentIntent</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-bold">3</div>
                <span className="text-slate-300">Provider selector chooses best provider</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-bold">4</div>
                <span className="text-slate-300">Redirect to payment provider</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-primary font-bold">5</div>
                <span className="text-slate-300">Webhook confirms payment</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <CheckCircle2 size={16} className="text-green-400" />
                Automatic failover between providers
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <CheckCircle2 size={16} className="text-green-400" />
                Real-time status updates
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <CheckCircle2 size={16} className="text-green-400" />
                Complete audit trail
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <CheckCircle2 size={16} className="text-green-400" />
                Email notifications with PDF invoices
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <CheckCircle2 size={16} className="text-green-400" />
                LMS integration for course access
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Lock size={20} className="text-amber-600" />
        </div>
        <div>
          <h3 className="font-bold text-amber-900 mb-1">Security Notice</h3>
          <p className="text-sm text-amber-800">
            Always use environment variables for sensitive credentials. Never commit API keys to version control. 
            In production, use a secrets manager like AWS Secrets Manager or HashiCorp Vault.
          </p>
        </div>
      </div>
    </div>
  );
}
