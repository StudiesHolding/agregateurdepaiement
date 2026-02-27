"use client";

import { Download, RefreshCw, Shield, Bug, ArrowUp } from "lucide-react";
import Link from "next/link";

const updateSteps = [
  {
    title: "Backup Database",
    description: "Create a full backup before updating",
    code: "mysqldump -u user -p payment_db > backup_$(date +%Y%m%d).sql",
  },
  {
    title: "Pull Latest Code",
    description: "Fetch the latest changes from repository",
    code: "git pull origin main",
  },
  {
    title: "Install Dependencies",
    description: "Update npm packages if needed",
    code: "npm install",
  },
  {
    title: "Run Migrations",
    description: "Apply any new database migrations",
    code: "npx sequelize db:migrate",
  },
  {
    title: "Restart Services",
    description: "Restart the application",
    code: "pm2 restart all",
  },
];

const versioning = [
  {
    type: "Major",
    description: "Breaking changes, requires migration",
    example: "1.0.0 → 2.0.0",
  },
  {
    type: "Minor",
    description: "New features, backward compatible",
    example: "1.0.0 → 1.1.0",
  },
  {
    type: "Patch",
    description: "Bug fixes, backward compatible",
    example: "1.0.0 → 1.0.1",
  },
];

export default function UpdatesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">
          Updates & Maintenance
        </h1>
        <p className="text-lg text-slate-600">
          Guide for updating and maintaining the payment aggregator.
        </p>
      </div>

      {/* Version Info */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-6">
        <h2 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
          <ArrowUp size={20} />
          Current Version: v1.0.0
        </h2>
        <p className="text-purple-800">
          This documentation is for version 1.0.0 of the payment aggregator.
        </p>
      </div>

      {/* Semantic Versioning */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Versioning</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {versioning.map((v, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-4"
            >
              <div className="font-bold text-slate-900 mb-2">{v.type}</div>
              <p className="text-sm text-slate-600 mb-2">{v.description}</p>
              <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                {v.example}
              </code>
            </div>
          ))}
        </div>
      </div>

      {/* Update Process */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Update Process
        </h2>
        <div className="space-y-4">
          {updateSteps.map((step, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{step.title}</div>
                    <div className="text-sm text-slate-500">
                      {step.description}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-sm overflow-x-auto">
                  {step.code}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rollback */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Rollback Procedure
        </h2>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="font-bold text-red-900 mb-3 flex items-center gap-2">
            <RefreshCw size={18} />
            Emergency Rollback
          </h3>
          <p className="text-red-800 mb-4">
            If an update causes issues, follow these steps to rollback:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-red-700 text-sm">
            <li>
              Stop the application:{" "}
              <code className="bg-white px-1 rounded">pm2 stop all</code>
            </li>
            <li>
              Restore database:{" "}
              <code className="bg-white px-1 rounded">
                mysql -u user -p payment_db &lt; backup_date.sql
              </code>
            </li>
            <li>
              Revert code:{" "}
              <code className="bg-white px-1 rounded">git revert HEAD</code>
            </li>
            <li>
              Restart:{" "}
              <code className="bg-white px-1 rounded">pm2 restart all</code>
            </li>
          </ol>
        </div>
      </div>

      {/* Monitoring */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Post-Update Monitoring
        </h2>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-slate-600 mb-4">
            After updating, monitor these key metrics:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="font-bold text-slate-900">Error Rate</div>
              <div className="text-sm text-slate-500">Should be {"<"} 1%</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="font-bold text-slate-900">Response Time</div>
              <div className="text-sm text-slate-500">
                Should be {"<"} 500ms
              </div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="font-bold text-slate-900">Success Rate</div>
              <div className="text-sm text-slate-500">Should be {">"} 95%</div>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="font-bold text-slate-900">Email Queue</div>
              <div className="text-sm text-slate-500">Should be empty</div>
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="flex items-center justify-between pt-8 border-t border-slate-200">
        <Link
          href="/docs/maintenance/troubleshooting"
          className="text-slate-600 hover:text-slate-900"
        >
          ← Troubleshooting
        </Link>
        <Link href="/docs" className="btn btn-primary">
          Back to Docs →
        </Link>
      </div>
    </div>
  );
}
