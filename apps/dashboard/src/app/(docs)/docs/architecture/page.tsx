"use client";

import Link from "next/link";
import { ArrowRight, Server, Database, Shield, Globe, Mail, CreditCard } from "lucide-react";

const architecture = [
  {
    title: "Backend API",
    icon: Server,
    description: "Express.js server handling all payment operations",
    components: [
      "RESTful API endpoints",
      "Provider integration (Stripe, CinetPay, KKiaPay)",
      "Webhook processor",
      "Order management",
      "Authentication & authorization"
    ]
  },
  {
    title: "Database",
    icon: Database,
    description: "MySQL database with Sequelize ORM",
    components: [
      "Orders & transactions",
      "Payment attempts",
      "Webhook events",
      "Audit logs",
      "Provider configurations"
    ]
  },
  {
    title: "Payment Providers",
    icon: CreditCard,
    description: "Multi-provider payment aggregation",
    components: [
      "Stripe (cards)",
      "CinetPay (Africa)",
      "KKiaPay (Africa)",
      "Automatic failover",
      "Provider routing"
    ]
  },
  {
    title: "Security",
    icon: Shield,
    description: "Security & authentication",
    components: [
      "API Key authentication",
      "Webhook signature validation",
      "Rate limiting",
      "Input validation",
      "SQL injection prevention"
    ]
  },
  {
    title: "Notifications",
    icon: Mail,
    description: "Email notifications & webhooks",
    components: [
      "Transaction emails",
      "PDF invoice generation",
      "Webhook delivery",
      "Email templates"
    ]
  },
  {
    title: "LMS Integration",
    icon: Globe,
    description: "WordPress/LearnPress bridge",
    components: [
      "User creation",
      "Course enrollment",
      "Access management",
      "Credential delivery"
    ]
  }
];

export default function ArchitecturePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">System Architecture</h1>
        <p className="text-lg text-slate-600">
          Overview of the payment aggregator system architecture and components.
        </p>
      </div>

      {/* Architecture Diagram */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-8">
        <h2 className="font-bold text-slate-900 mb-6 text-center">High-Level Architecture</h2>
        <div className="flex flex-wrap justify-center gap-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center min-w-[140px]">
            <Globe size={32} className="mx-auto text-primary mb-2" />
            <div className="font-bold text-slate-900">Frontend</div>
            <div className="text-xs text-slate-500">Customer Site</div>
          </div>
          <div className="flex items-center text-slate-400">
            <ArrowRight size={24} />
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center min-w-[140px]">
            <Server size={32} className="mx-auto text-primary mb-2" />
            <div className="font-bold text-slate-900">Backend API</div>
            <div className="text-xs text-slate-500">Express.js</div>
          </div>
          <div className="flex items-center text-slate-400">
            <ArrowRight size={24} />
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center min-w-[140px]">
            <Database size={32} className="mx-auto text-primary mb-2" />
            <div className="font-bold text-slate-900">Database</div>
            <div className="text-xs text-slate-500">MySQL</div>
          </div>
        </div>
        <div className="flex justify-center gap-8 mt-6">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CreditCard size={16} /> Payment Providers
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mail size={16} /> Email Service
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Globe size={16} /> WordPress LMS
          </div>
        </div>
      </div>

      {/* Components */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Core Components</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {architecture.map((item, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <item.icon size={24} className="text-primary" />
                <h3 className="font-bold text-slate-900">{item.title}</h3>
              </div>
              <p className="text-sm text-slate-600 mb-3">{item.description}</p>
              <ul className="text-xs text-slate-500 space-y-1">
                {item.components.map((comp, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full" />
                    {comp}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Data Flow */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Payment Flow</h2>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <ol className="space-y-4">
            <li className="flex gap-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</div>
              <div>
                <div className="font-bold text-slate-900">Customer initiates payment</div>
                <p className="text-sm text-slate-600">Frontend calls /api/payments/initialize</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</div>
              <div>
                <div className="font-bold text-slate-900">Backend creates order & selects provider</div>
                <p className="text-sm text-slate-600">Orchestrator selects best provider based on routing rules</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</div>
              <div>
                <div className="font-bold text-slate-900">Customer redirected to payment provider</div>
                <p className="text-sm text-slate-600">Payment URL returned to frontend</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">4</div>
              <div>
                <div className="font-bold text-slate-900">Provider sends webhook</div>
                <p className="text-sm text-slate-600">Backend receives & validates payment confirmation</p>
              </div>
            </li>
            <li className="flex gap-4">
              <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">5</div>
              <div>
                <div className="font-bold text-slate-900">Order updated & LMS access granted</div>
                <p className="text-sm text-slate-600">Admin validates, user created in WordPress, access sent</p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      {/* Next Steps */}
      <div className="flex items-center justify-between pt-8 border-t border-slate-200">
        <Link href="/docs" className="text-slate-600 hover:text-slate-900">
          ← Introduction
        </Link>
        <Link href="/docs/quick-start" className="btn btn-primary">
          Quick Start →
        </Link>
      </div>
    </div>
  );
}
