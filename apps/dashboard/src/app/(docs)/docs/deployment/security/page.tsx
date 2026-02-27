"use client";

import { Shield, Lock, Key, Server, Database, Eye, AlertTriangle } from "lucide-react";
import Link from "next/link";

const securityMeasures = [
  {
    title: "API Key Authentication",
    icon: Key,
    description: "All API endpoints require valid API keys for authentication",
    details: [
      "API keys must be included in x-api-key header",
      "Admin endpoints require keys with admin: prefix",
      "Keys can be generated and revoked from dashboard"
    ]
  },
  {
    title: "Webhook Signature Validation",
    icon: Shield,
    description: "All incoming webhooks are validated for authenticity",
    details: [
      "Providers sign their webhooks with HMAC-SHA256",
      "Signatures are verified before processing",
      "Invalid signatures are rejected"
    ]
  },
  {
    title: "Input Validation & Sanitization",
    icon: Lock,
    description: "All user inputs are validated and sanitized",
    details: [
      "Email format validation",
      "Phone number format validation",
      "Amount must be positive integer",
      "SQL injection prevention via parameterized queries"
    ]
  },
  {
    title: "Rate Limiting",
    icon: Server,
    description: "API endpoints are rate limited to prevent abuse",
    details: [
      "100 requests per minute per IP",
      "Exceeding limits returns 429 status",
      "Configurable via environment variables"
    ]
  },
  {
    title: "Database Security",
    icon: Database,
    description: "Database access is secured through best practices",
    details: [
      "Parameterized queries prevent SQL injection",
      "Database user has minimal required privileges",
      "Connection encryption (SSL/TLS)"
    ]
  },
  {
    title: "Sensitive Data Protection",
    icon: Eye,
    description: "Sensitive data is properly protected",
    details: [
      "API keys stored as environment variables",
      "Database credentials encrypted at rest",
      "No sensitive data in logs",
      "Passwords hashed with bcrypt"
    ]
  }
];

const bestPractices = [
  "Never commit API keys to version control",
  "Use strong, unique passwords for all accounts",
  "Enable two-factor authentication where available",
  "Regularly rotate API keys",
  "Monitor logs for suspicious activity",
  "Keep dependencies up to date",
  "Use HTTPS in production",
  "Configure firewall rules"
];

export default function SecurityPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">Security Guide</h1>
        <p className="text-lg text-slate-600">
          Security best practices and measures implemented in the payment aggregator.
        </p>
      </div>

      {/* Security Overview */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6">
        <h2 className="font-bold text-green-900 mb-4 flex items-center gap-2">
          <Shield size={20} />
          Security at a Glance
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">TLS 1.3</div>
            <div className="text-xs text-slate-500">Encryption</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">HMAC</div>
            <div className="text-xs text-slate-500">Signatures</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">bcrypt</div>
            <div className="text-xs text-slate-500">Hashing</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">Rate Limit</div>
            <div className="text-xs text-slate-500">100/min</div>
          </div>
        </div>
      </div>

      {/* Security Measures */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Implemented Security Measures</h2>
        <div className="space-y-4">
          {securityMeasures.map((measure, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <measure.icon size={24} className="text-primary" />
                <h3 className="font-bold text-slate-900">{measure.title}</h3>
              </div>
              <p className="text-slate-600 mb-3">{measure.description}</p>
              <ul className="text-sm text-slate-500 space-y-1">
                {measure.details.map((detail, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full" />
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Best Practices */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <h2 className="font-bold text-amber-900 mb-4 flex items-center gap-2">
          <AlertTriangle size={20} />
          Best Practices Checklist
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {bestPractices.map((practice, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-amber-800">
              <Shield size={14} className="text-amber-600" />
              {practice}
            </div>
          ))}
        </div>
      </div>

      {/* Compliance */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Compliance</h2>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-slate-600 mb-4">
            The payment aggregator follows security best practices and helps you maintain compliance with:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <div className="font-bold text-slate-900">PCI-DSS</div>
              <div className="text-xs text-slate-500">Payment Card Industry</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <div className="font-bold text-slate-900">GDPR</div>
              <div className="text-xs text-slate-500">Data Protection (EU)</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <div className="font-bold text-slate-900">CCPA</div>
              <div className="text-xs text-slate-500">California Privacy</div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="flex items-center justify-between pt-8 border-t border-slate-200">
        <Link href="/docs/deployment/environment" className="text-slate-600 hover:text-slate-900">
          ← Environment
        </Link>
        <Link href="/docs/maintenance/monitoring" className="btn btn-primary">
          Monitoring →
        </Link>
      </div>
    </div>
  );
}
