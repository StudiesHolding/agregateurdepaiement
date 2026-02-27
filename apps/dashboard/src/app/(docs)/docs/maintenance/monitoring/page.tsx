"use client";

import {
  Activity,
  AlertTriangle,
  Database,
  HardDrive,
  Mail,
  Server,
  Shield,
} from "lucide-react";
import Link from "next/link";

const metrics = [
  {
    title: "API Response Time",
    target: "< 500ms",
    critical: "> 2s",
    icon: Activity,
  },
  {
    title: "Database Connections",
    target: "< 50% max",
    critical: "> 80% max",
    icon: Database,
  },
  {
    title: "Memory Usage",
    target: "< 70%",
    critical: "> 90%",
    icon: HardDrive,
  },
  {
    title: "CPU Usage",
    target: "< 60%",
    critical: "> 85%",
    icon: Server,
  },
];

const alerts = [
  {
    level: "critical",
    title: "Database unavailable",
    action: "Check MySQL service: sudo systemctl status mysql",
    icon: AlertTriangle,
  },
  {
    level: "warning",
    title: "High error rate (>5%)",
    action: "Check logs: pm2 logs payment-api --err --lines 100",
    icon: Activity,
  },
  {
    level: "warning",
    title: "Email queue building up",
    action: "Check SMTP credentials and provider status",
    icon: Mail,
  },
];

const logLocations = [
  { path: "pm2 logs payment-api", description: "Application logs" },
  { path: "/var/log/nginx/access.log", description: "HTTP access logs" },
  { path: "/var/log/nginx/error.log", description: "Nginx errors" },
  { path: "/var/log/mysql/error.log", description: "MySQL errors" },
];

const cronJobs = [
  {
    name: "Provider Stats Cache",
    schedule: "Every 5 minutes",
    command: "node scripts/cron-stats.js",
  },
  {
    name: "Clean old webhook events",
    schedule: "Daily at 2am",
    command:
      "DELETE FROM webhook_events WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)",
  },
];

export default function MonitoringPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">
          Maintenance & Monitoring
        </h1>
        <p className="text-lg text-slate-600">
          Best practices for monitoring your payment aggregator in production.
        </p>
      </div>

      {/* Key Metrics */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Key Metrics to Monitor
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metrics.map((metric, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <metric.icon size={20} className="text-primary" />
                <div className="font-bold text-slate-900">{metric.title}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Target:</span>
                  <div className="font-mono text-green-600">
                    {metric.target}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">Critical:</span>
                  <div className="font-mono text-red-600">
                    {metric.critical}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PM2 Monitoring */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">PM2 Commands</h2>
        <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left p-2">Command</th>
                <th className="text-left p-2">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-800">
                <td className="p-2 font-mono text-primary">pm2 status</td>
                <td className="p-2 text-slate-300">Show all processes</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="p-2 font-mono text-primary">pm2 monit</td>
                <td className="p-2 text-slate-300">Real-time dashboard</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="p-2 font-mono text-primary">
                  pm2 logs --lines 100
                </td>
                <td className="p-2 text-slate-300">View recent logs</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="p-2 font-mono text-primary">pm2 restart all</td>
                <td className="p-2 text-slate-300">Restart all services</td>
              </tr>
              <tr className="border-b border-slate-800">
                <td className="p-2 font-mono text-primary">pm2 flush</td>
                <td className="p-2 text-slate-300">Clear log files</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Locations */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Log Files</h2>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 font-bold text-slate-900">Path</th>
                <th className="text-left p-3 font-bold text-slate-900">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {logLocations.map((log, idx) => (
                <tr key={idx} className="border-t border-slate-200">
                  <td className="p-3 font-mono text-sm text-primary">
                    {log.path}
                  </td>
                  <td className="p-3 text-slate-600">{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert Conditions */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Alert Conditions
        </h2>
        <div className="space-y-3">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 p-4 rounded-xl border ${
                alert.level === "critical"
                  ? "bg-red-50 border-red-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <alert.icon
                size={20}
                className={
                  alert.level === "critical" ? "text-red-600" : "text-amber-600"
                }
              />
              <div>
                <div className="font-bold text-slate-900">{alert.title}</div>
                <code className="text-sm text-slate-600">{alert.action}</code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cron Jobs */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Scheduled Tasks
        </h2>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 font-bold text-slate-900">Task</th>
                <th className="text-left p-3 font-bold text-slate-900">
                  Schedule
                </th>
                <th className="text-left p-3 font-bold text-slate-900">
                  Command
                </th>
              </tr>
            </thead>
            <tbody>
              {cronJobs.map((job, idx) => (
                <tr key={idx} className="border-t border-slate-200">
                  <td className="p-3 font-bold text-slate-900">{job.name}</td>
                  <td className="p-3 text-slate-600">{job.schedule}</td>
                  <td className="p-3 font-mono text-sm text-primary">
                    {job.command}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backup */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h2 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
          <Shield size={20} />
          Backup Strategy
        </h2>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            <strong>Database:</strong> Daily automated backup recommended
          </p>
          <p>
            <strong>Code:</strong> Git repository (GitHub)
          </p>
          <p>
            <strong>Environment:</strong> Store .env in secure location (not in
            repo)
          </p>
          <code className="block bg-white p-3 rounded mt-2">
            mysqldump -u user -p payment_db {" >"} backup_$(date +%Y%m%d).sql
          </code>
        </div>
      </div>

      {/* Next Steps */}
      <div className="flex items-center justify-between pt-8 border-t border-slate-200">
        <Link
          href="/docs/deployment/vps"
          className="text-slate-600 hover:text-slate-900"
        >
          ← VPS Deployment
        </Link>
        <Link
          href="/docs/maintenance/troubleshooting"
          className="btn btn-primary"
        >
          Troubleshooting →
        </Link>
      </div>
    </div>
  );
}
