"use client";

import {
  Copy,
  CheckCircle2,
  Settings,
  Server,
  Database,
  Mail,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const envSections = [
  {
    title: "Database",
    icon: Database,
    vars: [
      { name: "DATABASE_HOST", required: true, example: "localhost" },
      { name: "DATABASE_PORT", required: true, example: "3306" },
      { name: "DATABASE_NAME", required: true, example: "payment_db" },
      { name: "DATABASE_USER", required: true, example: "app_user" },
      { name: "DATABASE_PASSWORD", required: true, example: "***" },
    ],
  },
  {
    title: "Payment Providers",
    icon: Server,
    vars: [
      { name: "CINETPAY_API_KEY", required: true, example: "***" },
      { name: "CINETPAY_SITE_ID", required: true, example: "123456" },
      { name: "STRIPE_SECRET_KEY", required: false, example: "sk_live_***" },
      { name: "STRIPE_WEBHOOK_SECRET", required: false, example: "whsec_***" },
      { name: "KKIAPAY_SECRET_KEY", required: false, example: "sk_***" },
    ],
  },
  {
    title: "Email (SMTP)",
    icon: Mail,
    vars: [
      { name: "MAIL_HOST", required: true, example: "smtp.ionos.fr" },
      { name: "MAIL_PORT", required: true, example: "587" },
      { name: "MAIL_USER", required: true, example: "no-reply@domain.com" },
      { name: "MAIL_PASS", required: true, example: "***" },
      {
        name: "MAIL_FROM",
        required: true,
        example: "Studies Learning <no-reply@domain.com>",
      },
    ],
  },
  {
    title: "Security",
    icon: Lock,
    vars: [
      {
        name: "JWT_SECRET",
        required: true,
        example: "min_32_characters_string",
      },
      { name: "ADMIN_MASTER_KEY", required: true, example: "admin:***" },
      { name: "ENCRYPTION_KEY", required: false, example: "32_char_key" },
    ],
  },
];

export default function EnvironmentPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">
          Environment Configuration
        </h1>
        <p className="text-lg text-slate-600">
          Complete guide to configuring environment variables for the payment
          aggregator.
        </p>
      </div>

      {/* Quick Start */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h2 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
          <Settings size={20} />
          Quick Setup
        </h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
          <li>
            Copy <code className="bg-white px-1 rounded">.env.example</code> to{" "}
            <code className="bg-white px-1 rounded">.env</code>
          </li>
          <li>Fill in all required values</li>
          <li>Restart the server</li>
          <li>Test the configuration</li>
        </ol>
      </div>

      {/* Environment Variables */}
      {envSections.map((section, idx) => (
        <div key={idx}>
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <section.icon size={20} className="text-primary" />
            {section.title}
          </h2>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 font-bold text-slate-900">
                    Variable
                  </th>
                  <th className="text-left p-3 font-bold text-slate-900">
                    Required
                  </th>
                  <th className="text-left p-3 font-bold text-slate-900">
                    Example
                  </th>
                </tr>
              </thead>
              <tbody>
                {section.vars.map((v, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="p-3 font-mono text-sm text-primary">
                      {v.name}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          v.required
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {v.required ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-sm text-slate-500">
                      {v.example}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Example .env file */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Example .env File
        </h2>
        <div className="bg-slate-900 rounded-xl overflow-hidden">
          <div className="p-4 bg-slate-800 flex items-center justify-between">
            <span className="text-sm text-slate-300">.env</span>
            <button
              onClick={() => copyToClipboard(envExample, "env-example")}
              className="text-slate-400 hover:text-slate-200"
            >
              {copied === "env-example" ? (
                <CheckCircle2 size={16} />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>
          <pre className="p-4 text-slate-100 text-sm overflow-x-auto">
            {envExample}
          </pre>
        </div>
      </div>

      {/* Next Steps */}
      <div className="flex items-center justify-between pt-8 border-t border-slate-200">
        <Link
          href="/docs/deployment/vps"
          className="text-slate-600 hover:text-slate-900"
        >
          ← VPS Setup
        </Link>
        <Link href="/docs/deployment/security" className="btn btn-primary">
          Security →
        </Link>
      </div>
    </div>
  );
}

const envExample = `# Database
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=payment_db
DATABASE_USER=app_user
DATABASE_PASSWORD=strong_password

# Payment Providers
CINETPAY_API_KEY=your_cinetpay_key
CINETPAY_SITE_ID=123456
STRIPE_SECRET_KEY=sk_live_xxx
KKIAPAY_SECRET_KEY=sk_xxx

# Email (SMTP)
MAIL_HOST=smtp.ionos.fr
MAIL_PORT=587
MAIL_USER=no-reply@domain.com
MAIL_PASS=your_password
MAIL_FROM=Studies Learning <no-reply@domain.com>

# Security
JWT_SECRET=your_32_character_minimum_secret_key
ADMIN_MASTER_KEY=admin:your_master_key

# App
NODE_ENV=production
PORT=3000`;
