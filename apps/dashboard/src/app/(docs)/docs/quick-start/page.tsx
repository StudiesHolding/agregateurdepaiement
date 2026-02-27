"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Terminal, Code, Globe, Database, Mail, Shield } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Clone & Install",
    description: "Get the project and install dependencies",
    code: `git clone https://github.com/StudiesHolding/agregateurdepaiement.git
cd agregateurdepaisie
npm install
cd apps/backend && npm install
cd ../dashboard && npm install`
  },
  {
    number: "02",
    title: "Configure Environment",
    description: "Set up your environment variables",
    code: `# Copy the example env file
cp apps/backend/.env.example apps/backend/.env

# Edit with your credentials
DATABASE_HOST=localhost
DATABASE_NAME=your_db_name
DATABASE_USER=your_user
DATABASE_PASSWORD=your_password`
  },
  {
    number: "03",
    title: "Setup Database",
    description: "Create and migrate your database",
    code: `# Run migrations
mysql -u root -p your_db_name < apps/backend/scripts/migration-fix-missing-columns.sql

# Or use Sequelize
cd apps/backend
npm run db:sync`
  },
  {
    number: "04",
    title: "Start Services",
    description: "Launch backend and dashboard",
    code: `# Terminal 1 - Backend
cd apps/backend
npm run dev

# Terminal 2 - Dashboard
cd apps/dashboard
npm run dev`
  },
  {
    number: "05",
    title: "Test Integration",
    description: "Verify everything is working",
    code: `# Test health endpoint
curl http://localhost:3000/health

# Test dashboard
open http://localhost:3001`
  }
];

const prerequisites = [
  "Node.js 18+ installed",
  "MySQL 8.0+ database",
  "Payment provider accounts (Stripe, CinetPay, KKiaPay)",
  "Git installed"
];

export default function QuickStartPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">Quick Start Guide</h1>
        <p className="text-lg text-slate-600">
          Get up and running with the payment aggregator in under 5 minutes.
        </p>
      </div>

      {/* Prerequisites */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <h2 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
          <CheckCircle2 size={20} />
          Prerequisites
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {prerequisites.map((item) => (
            <li key={item} className="text-sm text-blue-800 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-blue-500" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Steps */}
      <div className="space-y-8">
        {steps.map((step, idx) => (
          <div key={step.number} className="relative">
            {idx < steps.length - 1 && (
              <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-slate-200 -z-10" />
            )}
            <div className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-primary/25">
                {step.number}
              </div>
              <div className="flex-1 space-y-3">
                <h3 className="text-xl font-bold text-slate-900">{step.title}</h3>
                <p className="text-slate-600">{step.description}</p>
                <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                  <pre className="text-sm text-slate-100 font-mono whitespace-pre-wrap">
                    {step.code}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Next Steps */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-8">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Next Steps</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/docs/api/payments" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/50 transition-colors">
            <Code size={20} className="text-primary" />
            <span className="font-medium text-slate-900">API Reference</span>
            <ArrowRight size={16} className="ml-auto text-slate-400" />
          </Link>
          <Link href="/docs/integration/frontend" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/50 transition-colors">
            <Globe size={20} className="text-primary" />
            <span className="font-medium text-slate-900">Frontend Guide</span>
            <ArrowRight size={16} className="ml-auto text-slate-400" />
          </Link>
          <Link href="/docs/deployment/vps" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-primary/50 transition-colors">
            <Terminal size={20} className="text-primary" />
            <span className="font-medium text-slate-900">Deploy to VPS</span>
            <ArrowRight size={16} className="ml-auto text-slate-400" />
          </Link>
        </div>
      </div>
    </div>
  );
}
