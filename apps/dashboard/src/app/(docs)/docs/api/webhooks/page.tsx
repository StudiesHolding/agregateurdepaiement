"use client";

import { useState } from "react";
import { Copy, CheckCircle2, ChevronRight } from "lucide-react";
import Link from "next/link";

const providers = [
  {
    name: "CinetPay",
    path: "/api/webhooks/cinetpay",
    description: "African payment gateway supporting mobile money and cards",
    signature: "x-cinetpay-token",
    payload: `{
  "event_type": "payment.success",
  "cpm_trans_id": "TXN123456",
  "cpm_result": "00",
  "cpm_amount": "5000",
  "cpm_currency": "XAF",
  "customer_phone_number": "+237600000000",
  "customer_email": "customer@example.com"
}`,
  },
  {
    name: "Stripe",
    path: "/api/webhooks/stripe",
    description: "Global payment platform",
    signature: "Stripe-Signature",
    payload: `{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_xxx",
      "payment_status": "paid",
      "amount_total": 5000,
      "metadata": {
        "transactionNumber": "TXN123"
      }
    }
  }
}`,
  },
  {
    name: "KKiaPay",
    path: "/api/webhooks/kkiapay",
    description: "West African mobile money integration",
    signature: "x-kkiapay-secret",
    payload: `{
  "event": "transaction.success",
  "transactionId": "TXN123",
  "partnerId": "PARTNER123",
  "amount": 5000,
  "isPaymentSucces": true,
  "status": "success"
}`,
  },
];

export default function WebhooksPage() {
  const [activeProvider, setActiveProvider] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">Webhooks</h1>
        <p className="text-lg text-slate-600">
          Receive real-time payment notifications from payment providers.
        </p>
      </div>

      {/* Overview */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h2 className="font-bold text-blue-900 mb-4">How Webhooks Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <div className="font-bold text-blue-900 mb-2">
              1. Payment Occurs
            </div>
            <p className="text-blue-800">
              Customer completes payment on provider's page
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <div className="font-bold text-blue-900 mb-2">
              2. Provider Notifies
            </div>
            <p className="text-blue-800">
              Provider sends POST request to your webhook URL
            </p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-100">
            <div className="font-bold text-blue-900 mb-2">
              3. System Updates
            </div>
            <p className="text-blue-800">
              Backend validates, updates order, sends emails
            </p>
          </div>
        </div>
      </div>

      {/* Webhook URLs */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Webhook Endpoints
        </h2>
        <div className="bg-slate-900 rounded-xl p-4 space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className="flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-white">{provider.name}</span>
                <code className="block text-slate-400 text-sm">
                  {provider.path}
                </code>
              </div>
              <button
                onClick={() => copyToClipboard(provider.path, provider.name)}
                className="text-slate-400 hover:text-white"
              >
                {copied === provider.name ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <Copy size={18} />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Provider Details */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Provider Payloads
        </h2>
        <div className="space-y-4">
          {providers.map((provider, idx) => (
            <div
              key={provider.name}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              <button
                onClick={() =>
                  setActiveProvider(activeProvider === idx ? -1 : idx)
                }
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="text-left">
                  <div className="font-bold text-slate-900">
                    {provider.name}
                  </div>
                  <div className="text-sm text-slate-500">
                    {provider.description}
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className={`text-slate-400 transition-transform ${activeProvider === idx ? "rotate-90" : ""}`}
                />
              </button>

              {activeProvider === idx && (
                <div className="p-4 border-t border-slate-200 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-slate-900">
                        Signature Header
                      </h4>
                      <code className="bg-slate-100 px-2 py-1 rounded text-sm">
                        {provider.signature}
                      </code>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-slate-900">
                        Example Payload
                      </h4>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            provider.payload,
                            provider.name + "-payload",
                          )
                        }
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {copied === provider.name + "-payload" ? (
                          <CheckCircle2 size={16} />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                    </div>
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
                      {provider.payload}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Testing */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-6">
        <h2 className="font-bold text-green-900 mb-4">Testing Webhooks</h2>
        <p className="text-sm text-green-800 mb-4">
          Use the dashboard or API to simulate webhook events for testing:
        </p>
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm text-white">
          POST /api/admin/test/simulate-webhook
        </div>
        <pre className="mt-2 bg-slate-800 text-slate-300 p-3 rounded text-xs">
          {`{
  "orderId": 264,
  "provider": "cinetpay",
  "status": "success"
}`}
        </pre>
      </div>

      {/* Next Steps */}
      <div className="flex items-center justify-between pt-8 border-t border-slate-200">
        <Link
          href="/docs/api/payments"
          className="text-slate-600 hover:text-slate-900"
        >
          ← Payments API
        </Link>
        <Link href="/docs/api/admin" className="btn btn-primary">
          Admin API →
        </Link>
      </div>
    </div>
  );
}
