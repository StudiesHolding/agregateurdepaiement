"use client";

import { AlertCircle, CheckCircle2, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const issues = [
  {
    category: "Database",
    problems: [
      {
        title: "Error: Unknown column 'customer_country'",
        symptoms: ["500 error on /api/admin/orders", "Database column missing"],
        cause: "Migration not executed or failed",
        solution:
          "Run the database migration:\n\n```bash\nmysql -u user -p database < apps/backend/scripts/migration-fix-missing-columns.sql\n```\n\nOr enable Sequelize sync with alter:\n\n```javascript\n// In server.js\nawait sequelize.sync({ alter: true });\n```",
      },
      {
        title: "Error: Too many connections",
        symptoms: ["Database connection errors", "Server unresponsive"],
        cause: "MySQL max_connections exceeded",
        solution:
          "1. Check current connections:\n```sql\nSHOW STATUS LIKE 'Threads_connected';\n```\n\n2. Increase pool size in config/database.js:\n```javascript\npool: {\n  max: 50,\n  min: 5,\n  acquire: 30000,\n  idle: 10000\n}\n```",
      },
    ],
  },
  {
    category: "Payment Providers",
    problems: [
      {
        title: "No provider available for this configuration",
        symptoms: ["Payment initialization fails", "No redirect URL returned"],
        cause: "No provider routes configured for country/currency",
        solution:
          "1. Add provider routes in dashboard\n2. Or use admin API:\n```javascript\nPOST /api/admin/routes\n{\n  providerId: 1,\n  countryCode: 'CM',\n  currency: 'XAF',\n  priority: 1\n}\n```",
      },
      {
        title: "Webhook not received",
        symptoms: [
          "Order stuck in pending",
          "Payment confirmed but status not updated",
        ],
        cause: "Provider webhook URL not configured or inaccessible",
        solution:
          "1. Verify webhook URL is accessible from internet\n2. Check provider webhook settings in their dashboard\n3. Review webhook events in dashboard",
      },
    ],
  },
  {
    category: "Email",
    problems: [
      {
        title: "Emails not sending",
        symptoms: ["No confirmation emails", "Mail service errors in logs"],
        cause: "SMTP configuration incorrect or credentials invalid",
        solution:
          "1. Verify SMTP settings in .env\n2. Test email configuration:\n```bash\ncd apps/backend\nnode scripts/test-email.js\n```\n3. Check email provider (IONOS, SendGrid, etc.) for API keys",
      },
    ],
  },
  {
    category: "Authentication",
    problems: [
      {
        title: "401 Unauthorized - Missing API Key",
        symptoms: ["Authentication failed", "No API key provided"],
        cause: "x-api-key header not included in request",
        solution:
          "Add API key to request headers:\n```javascript\nfetch('/api/payments/initialize', {\n  headers: {\n    'Content-Type': 'application/json',\n    'x-api-key': 'your_api_key'\n  }\n})\n```",
      },
      {
        title: "403 Forbidden - Insufficient privileges",
        symptoms: ["Access denied to admin endpoints"],
        cause: "Using non-admin API key for admin endpoints",
        solution:
          "1. Generate admin-level API key\n2. Or use master key (development only):\n```\nADMIN_MASTER_KEY=admin:your_key\n```",
      },
    ],
  },
  {
    category: "Frontend",
    problems: [
      {
        title: "Dashboard not loading",
        symptoms: ["Blank page", "Console errors"],
        cause: "API not accessible or CORS issues",
        solution:
          "1. Check backend is running\n2. Verify NEXT_PUBLIC_API_BASE_URL\n3. Check browser console for errors\n4. Ensure CORS is configured in Express",
      },
      {
        title: "Buttons not showing on order page",
        symptoms: [
          "No validate/complete buttons",
          "Order stuck at payment_confirmed",
        ],
        cause: "Order status mismatch or cache issue",
        solution:
          "1. Check order status in database:\n```sql\nSELECT reference, status FROM aggp_orders;\n```\n\n2. Buttons appear at:\n- status='payment_confirmed' → Validate/Reject\n- status='validated' → Send credentials\n\n3. Hard refresh browser (Ctrl+Shift+R)",
      },
    ],
  },
];

export default function TroubleshootingPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredIssues = issues
    .map((category) => ({
      ...category,
      problems: category.problems.filter(
        (p) =>
          p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.symptoms.some((s) =>
            s.toLowerCase().includes(searchTerm.toLowerCase()),
          ),
      ),
    }))
    .filter((category) => category.problems.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">
          Troubleshooting Guide
        </h1>
        <p className="text-lg text-slate-600">
          Common issues and their solutions. Use the search to find specific
          problems.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          size={20}
        />
        <input
          type="text"
          placeholder="Search for issues..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      {/* Quick Fixes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-900 font-bold mb-2">
            <CheckCircle2 size={18} />
            Quick Fix: Restart Services
          </div>
          <code className="block text-sm text-green-800 bg-white p-2 rounded">
            pm2 restart all
          </code>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-900 font-bold mb-2">
            <CheckCircle2 size={18} />
            Quick Fix: Check Logs
          </div>
          <code className="block text-sm text-blue-800 bg-white p-2 rounded">
            pm2 logs payment-api --lines 50
          </code>
        </div>
      </div>

      {/* Issues by Category */}
      {filteredIssues.map((category, idx) => (
        <div key={idx} className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">
            {category.category}
          </h2>
          <div className="space-y-4">
            {category.problems.map((problem, pIdx) => (
              <details
                key={pIdx}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden"
              >
                <summary className="p-4 cursor-pointer hover:bg-slate-50 flex items-start gap-3">
                  <AlertCircle
                    size={20}
                    className="text-amber-500 flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <div className="font-bold text-slate-900">
                      {problem.title}
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {problem.symptoms.join(" • ")}
                    </div>
                  </div>
                </summary>
                <div className="p-4 border-t border-slate-200 bg-slate-50">
                  <div className="mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Cause:
                    </span>
                    <p className="text-sm text-slate-700">{problem.cause}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Solution:
                    </span>
                    <pre className="mt-2 bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                      {problem.solution}
                    </pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      ))}

      {/* Need More Help */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Need More Help?
        </h2>
        <p className="text-slate-600 mb-4">
          Check the GitHub issues or contact support for additional assistance.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a
            href="https://github.com/StudiesHolding/agregateurdepaiement/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            GitHub Issues
          </a>
          <Link href="/docs/deployment/vps" className="btn btn-secondary">
            Deployment Guide
          </Link>
        </div>
      </div>
    </div>
  );
}
