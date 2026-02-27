"use client";

import { useState } from "react";
import { Copy, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import Link from "next/link";

const endpoints = [
  {
    method: "POST",
    path: "/api/payments/initialize",
    title: "Initialize Payment",
    description: "Create a new payment intention and get redirect URL",
    requiresAuth: true,
    requestBody: `{
  "customerEmail": "customer@example.com",
  "customerName": "John",
  "customerSurname": "Doe",
  "customerPhoneNumber": "+237600000000",
  "customerCity": "Douala",
  "customerCountry": "CM",
  "currency": "XAF",
  "amount": 5000,
  "paymentMethod": "mobile_money",
  "countryCode": "CM",
  "successUrl": "https://yoursite.com/success",
  "cancelUrl": "https://yoursite.com/cancel",
  "lmsItemId": "123",
  "lmsItemType": "course"
}`,
    responseSuccess: `{
  "status": "success",
  "data": {
    "success": true,
    "orderReference": "ORD-ABC123XYZ",
    "paymentIntentId": "123",
    "transactionNumber": "TXN-ABC123",
    "redirectUrl": "https://provider.com/pay/xxx",
    "provider": "cinetpay"
  }
}`,
    responseError: `{
  "status": "fail",
  "data": {
    "success": false,
    "error": "No provider available"
  }
}`
  },
  {
    method: "GET",
    path: "/api/payments/:id/status",
    title: "Get Payment Status",
    description: "Check the current status of a payment",
    requiresAuth: true,
    responseSuccess: `{
  "status": "success",
  "data": {
    "id": 123,
    "status": "succeeded",
    "amount": 5000,
    "currency": "XAF",
    "orderReference": "ORD-ABC123XYZ",
    "attempts": [
      {
        "id": 1,
        "provider": "cinetpay",
        "status": "succeeded",
        "createdAt": "2026-02-26T10:00:00Z"
      }
    ]
  }
}`
  }
];

const requestFields = [
  { field: "customerEmail", required: true, type: "string", description: "Customer email address" },
  { field: "customerName", required: true, type: "string", description: "Customer first name" },
  { field: "customerSurname", required: false, type: "string", description: "Customer last name" },
  { field: "customerPhoneNumber", required: false, type: "string", description: "Phone number with country code" },
  { field: "customerCity", required: false, type: "string", description: "Customer city" },
  { field: "customerCountry", required: false, type: "string", description: "2-letter country code (default: CM)" },
  { field: "currency", required: true, type: "string", description: "Currency code (XAF, EUR, USD)" },
  { field: "amount", required: true, type: "number", description: "Amount in smallest currency unit" },
  { field: "paymentMethod", required: true, type: "string", description: "mobile_money, card" },
  { field: "countryCode", required: true, type: "string", description: "Country code for routing" },
  { field: "successUrl", required: false, type: "string", description: "Redirect after success" },
  { field: "cancelUrl", required: false, type: "string", description: "Redirect after cancellation" },
  { field: "lmsItemId", required: false, type: "string", description: "LMS course/package ID" },
  { field: "lmsItemType", required: false, type: "string", description: "course, package, subscription" },
];

export default function PaymentsAPIPage() {
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
        <h1 className="text-3xl font-black text-slate-900 mb-4">Payments API</h1>
        <p className="text-lg text-slate-600">
          Core payment endpoints for initiating and managing payments.
        </p>
      </div>

      {/* Base URL */}
      <div className="bg-slate-900 rounded-xl p-4 flex items-center justify-between">
        <div>
          <span className="text-slate-400 text-sm">Base URL</span>
          <code className="block text-white font-mono">http://localhost:3000/api</code>
        </div>
        <div className="text-right">
          <span className="text-slate-400 text-sm">Environment</span>
          <span className="block text-amber-400 font-medium">Development</span>
        </div>
      </div>

      {/* Authentication */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h2 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
          Authentication Required
        </h2>
        <p className="text-sm text-blue-800 mb-4">
          All payment endpoints require API key authentication.
        </p>
        <div className="bg-slate-900 rounded-lg p-3 font-mono text-sm text-white">
          x-api-key: your_api_key_here
        </div>
      </div>

      {/* Request Fields Table */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Request Fields</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-3 font-bold text-slate-700">Field</th>
                <th className="text-left p-3 font-bold text-slate-700">Required</th>
                <th className="text-left p-3 font-bold text-slate-700">Type</th>
                <th className="text-left p-3 font-bold text-slate-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {requestFields.map((field) => (
                <tr key={field.field} className="border-b border-slate-100">
                  <td className="p-3 font-mono text-primary">{field.field}</td>
                  <td className="p-3">
                    {field.required ? (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">Required</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-xs">Optional</span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-slate-600">{field.type}</td>
                  <td className="p-3 text-slate-600">{field.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Endpoints */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Endpoints</h2>
        <div className="space-y-4">
          {endpoints.map((endpoint, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setActiveEndpoint(activeEndpoint === idx ? -1 : idx)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`
                    px-2 py-1 rounded font-bold text-xs
                    ${endpoint.method === 'GET' ? 'bg-green-100 text-green-700' : ''}
                    ${endpoint.method === 'POST' ? 'bg-blue-100 text-blue-700' : ''}
                    ${endpoint.method === 'PUT' ? 'bg-orange-100 text-orange-700' : ''}
                    ${endpoint.method === 'DELETE' ? 'bg-red-100 text-red-700' : ''}
                  `}>
                    {endpoint.method}
                  </span>
                  <code className="text-sm font-mono text-slate-700">{endpoint.path}</code>
                </div>
                <ChevronRight size={18} className={`text-slate-400 transition-transform ${activeEndpoint === idx ? 'rotate-90' : ''}`} />
              </button>
              
              {activeEndpoint === idx && (
                <div className="p-4 border-t border-slate-200 space-y-4">
                  <p className="text-slate-600">{endpoint.description}</p>
                  
                  {endpoint.requestBody && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-slate-900">Request Body</h4>
                        <button
                          onClick={() => copyToClipboard(endpoint.requestBody!, 'request-' + idx)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {copied === 'request-' + idx ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
                        {endpoint.requestBody}
                      </pre>
                    </div>
                  )}
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-slate-900">Response (Success)</h4>
                      <button
                        onClick={() => copyToClipboard(endpoint.responseSuccess, 'success-' + idx)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        {copied === 'success-' + idx ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                    <pre className="bg-green-50 text-green-800 p-4 rounded-lg text-sm overflow-x-auto border border-green-200">
                      {endpoint.responseSuccess}
                    </pre>
                  </div>

                  {endpoint.responseError && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-slate-900">Response (Error)</h4>
                        <button
                          onClick={() => copyToClipboard(endpoint.responseError, 'error-' + idx)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {copied === 'error-' + idx ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                      <pre className="bg-red-50 text-red-800 p-4 rounded-lg text-sm overflow-x-auto border border-red-200">
                        {endpoint.responseError}
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
        <Link href="/docs" className="text-slate-600 hover:text-slate-900">
          ← Back to Docs
        </Link>
        <Link href="/docs/api/webhooks" className="btn btn-primary">
          Webhooks → 
        </Link>
      </div>
    </div>
  );
}
