"use client";

import { useState } from "react";
import { Copy, CheckCircle2, ChevronRight, Shield } from "lucide-react";
import Link from "next/link";

const endpoints = [
  {
    method: "GET",
    path: "/api/admin/kpis/overview",
    title: "Dashboard KPIs",
    description: "Get overview statistics for the dashboard",
    response: `{
  "revenue24h": 125000,
  "transactionCount24h": 45,
  "successRate": 92.5,
  "failoverRate": 5.2,
  "failoverCount": 3,
  "trends": { "revenue": 12.5, "transactions": -3.2 }
}`,
  },
  {
    method: "GET",
    path: "/api/admin/orders",
    title: "List Orders",
    description: "Get paginated list of orders with filters",
    queryParams: "?page=1&limit=20&status=pending&search=ORD-",
  },
  {
    method: "GET",
    path: "/api/admin/orders/:id",
    title: "Get Order Details",
    description: "Get complete order information with audit history",
  },
  {
    method: "POST",
    path: "/api/admin/orders/:id/validate",
    title: "Validate Order",
    description: "Approve or reject an order after payment confirmation",
    requestBody: `{
  "action": "validate",
  "notes": "Payment verified, documents complete"
}`,
    requestBody2: `{
  "action": "reject",
  "notes": "Suspicious payment"
}`,
  },
  {
    method: "POST",
    path: "/api/admin/orders/:id/complete",
    title: "Complete Order",
    description: "Send campus credentials to customer (final step)",
    requestBody: `{
  "username": "student.user",
  "password": "TempPass123!"
}`,
  },
];

const statuses = [
  { status: "pending", description: "Order created, waiting for payment" },
  { status: "payment_confirmed", description: "Payment received via webhook" },
  { status: "validated", description: "Admin approved the order" },
  { status: "completed", description: "Credentials sent to customer" },
  { status: "payment_failed", description: "Payment failed or expired" },
  { status: "rejected", description: "Order rejected by admin" },
];

export default function AdminAPIPage() {
  const [activeEndpoint, setActiveEndpoint] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">Admin API</h1>
        <p className="text-lg text-slate-600">
          Manage orders, view analytics, and configure providers.
        </p>
      </div>

      {/* Authentication */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield size={20} className="text-amber-600" />
          </div>
          <div>
            <h2 className="font-bold text-amber-900 mb-2">
              Admin Authentication Required
            </h2>
            <p className="text-sm text-amber-800 mb-4">
              All admin endpoints require an admin-level API key (keys starting
              with <code>admin:</code>).
            </p>
            <div className="bg-slate-900 rounded-lg p-3 font-mono text-sm text-white">
              x-api-key: admin:your_key_here
            </div>
          </div>
        </div>
      </div>

      {/* Order Statuses */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Order Statuses
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {statuses.map((item) => (
            <div
              key={item.status}
              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200"
            >
              <div
                className={`
                w-3 h-3 rounded-full
                ${item.status === "pending" ? "bg-amber-500" : ""}
                ${item.status === "payment_confirmed" ? "bg-blue-500" : ""}
                ${item.status === "validated" ? "bg-green-500" : ""}
                ${item.status === "completed" ? "bg-indigo-500" : ""}
                ${item.status === "payment_failed" ? "bg-red-500" : ""}
                ${item.status === "rejected" ? "bg-red-700" : ""}
              `}
              />
              <div>
                <code className="font-mono text-sm font-bold">
                  {item.status}
                </code>
                <p className="text-xs text-slate-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Endpoints */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Endpoints</h2>
        <div className="space-y-4">
          {endpoints.map((endpoint, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              <button
                onClick={() =>
                  setActiveEndpoint(activeEndpoint === idx ? -1 : idx)
                }
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`
                    px-2 py-1 rounded font-bold text-xs
                    ${endpoint.method === "GET" ? "bg-green-100 text-green-700" : ""}
                    ${endpoint.method === "POST" ? "bg-blue-100 text-blue-700" : ""}
                    ${endpoint.method === "PUT" ? "bg-orange-100 text-orange-700" : ""}
                    ${endpoint.method === "DELETE" ? "bg-red-100 text-red-700" : ""}
                  `}
                  >
                    {endpoint.method}
                  </span>
                  <code className="text-sm font-mono text-slate-700">
                    {endpoint.path}
                  </code>
                </div>
                <ChevronRight
                  size={18}
                  className={`text-slate-400 transition-transform ${activeEndpoint === idx ? "rotate-90" : ""}`}
                />
              </button>

              {activeEndpoint === idx && (
                <div className="p-4 border-t border-slate-200 space-y-4">
                  <p className="text-slate-600">{endpoint.description}</p>

                  {endpoint.queryParams && (
                    <div>
                      <h4 className="font-bold text-slate-900 mb-2">
                        Query Parameters
                      </h4>
                      <code className="bg-slate-100 px-2 py-1 rounded text-sm">
                        {endpoint.queryParams}
                      </code>
                    </div>
                  )}

                  {endpoint.requestBody && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-slate-900">
                          Request Body
                        </h4>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              endpoint.requestBody!,
                              "request-" + idx,
                            )
                          }
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {copied === "request-" + idx ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                      </div>
                      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
                        {endpoint.requestBody}
                      </pre>
                      {endpoint.requestBody2 && (
                        <pre className="mt-2 bg-red-50 text-red-800 p-4 rounded-lg text-sm overflow-x-auto border border-red-200">
                          {endpoint.requestBody2}
                        </pre>
                      )}
                    </div>
                  )}

                  {endpoint.response && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-slate-900">Response</h4>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              endpoint.response!,
                              "response-" + idx,
                            )
                          }
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {copied === "response-" + idx ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                      </div>
                      <pre className="bg-green-50 text-green-800 p-4 rounded-lg text-sm overflow-x-auto border border-green-200">
                        {endpoint.response}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Next Steps */}
      <div className="flex items-center justify-between pt-8 border-t border-slate-200">
        <Link
          href="/docs/api/webhooks"
          className="text-slate-600 hover:text-slate-900"
        >
          ← Webhooks
        </Link>
        <Link href="/docs/integration/frontend" className="btn btn-primary">
          Frontend Guide →
        </Link>
      </div>
    </div>
  );
}
