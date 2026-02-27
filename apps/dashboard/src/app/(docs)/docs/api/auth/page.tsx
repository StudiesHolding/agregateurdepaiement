"use client";

import { Copy, CheckCircle2, Shield, Key, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const authMethods = [
  {
    title: "API Key Authentication",
    icon: Key,
    description: "Use API keys for server-to-server communication",
    header: "x-api-key",
    example: "sk_live_1234567890abcdef"
  },
  {
    title: "Admin Authentication",
    icon: Shield,
    description: "Admin keys for dashboard access (prefix: admin:)",
    header: "x-api-key",
    example: "admin:your_master_key"
  }
];

const securityTips = [
  "Never expose API keys in client-side code",
  "Rotate keys periodically",
  "Use different keys for development and production",
  "Set up IP allowlists for production keys",
  "Monitor API key usage for anomalies"
];

export default function AuthPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">Authentication</h1>
        <p className="text-lg text-slate-600">
          Learn how to authenticate with the payment aggregator API.
        </p>
      </div>

      {/* Authentication Methods */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Authentication Methods</h2>
        <div className="space-y-4">
          {authMethods.map((method, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <method.icon size={24} className="text-primary" />
                <h3 className="font-bold text-slate-900">{method.title}</h3>
              </div>
              <p className="text-slate-600 mb-4">{method.description}</p>
              <div className="bg-slate-900 rounded-lg p-4">
                <div className="text-xs text-slate-400 mb-2">Header</div>
                <code className="text-primary">{method.header}: {method.example}</code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Key Usage */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Using API Keys</h2>
        <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
          <pre className="text-slate-100 text-sm">
{`// Example: Initialize Payment
fetch('/api/payments/initialize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your_api_key_here'
  },
  body: JSON.stringify({
    amount: 25000,
    currency: 'XAF',
    customer: {
      email: 'customer@example.com'
    }
  })
})`}
          </pre>
        </div>
      </div>

      {/* Generating Keys */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Generating API Keys</h2>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-bold text-slate-900 mb-3">Via Admin Dashboard</h3>
          <ol className="list-decimal list-inside space-y-2 text-slate-600">
            <li>Log in to the admin dashboard</li>
            <li>Navigate to Settings → API Keys</li>
            <li>Click "Generate New Key"</li>
            <li>Copy the key (it won't be shown again)</li>
          </ol>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 mt-4">
          <h3 className="font-bold text-slate-900 mb-3">Via Command Line</h3>
          <div className="bg-slate-900 rounded-lg p-4">
            <pre className="text-slate-100 text-sm">
{`cd apps/backend
node scripts/generate-key.js`}
            </pre>
          </div>
        </div>
      </div>

      {/* Security Best Practices */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h2 className="font-bold text-red-900 mb-4 flex items-center gap-2">
          <Lock size={20} />
          Security Best Practices
        </h2>
        <ul className="space-y-2 text-sm text-red-800">
          {securityTips.map((tip, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <CheckCircle2 size={16} /> {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* Next Steps */}
      <div className="flex items-center justify-between pt-8 border-t border-slate-200">
        <Link href="/docs" className="text-slate-600 hover:text-slate-900">
          ← Introduction
        </Link>
        <Link href="/docs/api/payments" className="btn btn-primary">
          Payments API →
        </Link>
      </div>
    </div>
  );
}
