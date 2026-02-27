"use client";

import { Copy, CheckCircle2, CreditCard, Globe, Code } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const integrationSteps = [
  {
    title: "1. Initialize Payment",
    description: "Create a payment intent and get the provider redirect URL",
    method: "POST",
    endpoint: "/api/payments/initialize",
    request: {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "your_api_key"
      },
      body: {
        amount: 25000,
        currency: "XAF",
        customer: {
          email: "customer@example.com",
          firstname: "John",
          lastname: "Doe",
          phone: "+237612345678"
        },
        description: "Course payment - Advanced React",
        return_url: "https://yoursite.com/payment/success",
        cancel_url: "https://yoursite.com/payment/cancel"
      }
    },
    response: {
      success: true,
      data: {
        order_id: "ORD-2026-001",
        payment_url: "https://provider.com/pay/xxx",
        expires_at: "2026-02-26T15:00:00Z"
      }
    }
  },
  {
    title: "2. Redirect Customer",
    description: "Send the customer to the payment URL",
    method: "GET",
    endpoint: "payment_url from response",
    code: `// In your frontend
const handlePayment = async () => {
  const response = await initializePayment(orderData);
  
  if (response.success) {
    // Redirect to payment provider
    window.location.href = response.data.payment_url;
  }
};`
  },
  {
    title: "3. Handle Webhook",
    description: "Receive payment confirmation from provider",
    method: "POST",
    endpoint: "/api/webhooks/{provider}",
    code: `// Your webhook endpoint
app.post('/api/webhooks/cinetpay', async (req, res) => {
  const { transaction_id, status } = req.body;
  
  if (status === 'approved') {
    // Update order status in your database
    await updateOrderStatus(transaction_id, 'payment_confirmed');
  }
  
  res.json({ status: 'received' });
});`
  }
];

const sdkFeatures = [
  "Automatic provider selection",
  "Retry on failure",
  "Fraud detection",
  "Multi-currency support"
];

export default function FrontendIntegrationPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">Frontend Integration</h1>
        <p className="text-lg text-slate-600">
          Learn how to integrate payment processing into your frontend application.
        </p>
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Globe size={20} />
          Quick Integration Flow
        </h2>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
            <span className="text-slate-700">Initialize</span>
          </div>
          <div className="w-8 h-px bg-slate-300" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
            <span className="text-slate-700">Redirect</span>
          </div>
          <div className="w-8 h-px bg-slate-300" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
            <span className="text-slate-700">Confirm</span>
          </div>
          <div className="w-8 h-px bg-slate-300" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
            <span className="text-slate-700">Access</span>
          </div>
        </div>
      </div>

      {/* Integration Steps */}
      <div className="space-y-8">
        {integrationSteps.map((step, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  step.method === 'POST' ? 'bg-green-100 text-green-700' :
                  step.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {step.method}
                </span>
                <h3 className="font-bold text-slate-900">{step.title}</h3>
              </div>
              <p className="text-sm text-slate-500 mt-2">{step.description}</p>
            </div>
            <div className="p-4 space-y-4">
              {step.endpoint && (
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase">Endpoint</span>
                  <code className="block bg-slate-900 text-slate-100 p-3 rounded-lg mt-1 text-sm">
                    {step.endpoint}
                  </code>
                </div>
              )}
              
              {step.request && (
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase">Request Example</span>
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg mt-1 text-sm overflow-x-auto">
                    {JSON.stringify(step.request, null, 2)}
                  </pre>
                </div>
              )}

              {step.response && (
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase">Response</span>
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg mt-1 text-sm overflow-x-auto">
                    {JSON.stringify(step.response, null, 2)}
                  </pre>
                </div>
              )}

              {step.code && (
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase">Implementation</span>
                  <div className="relative">
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg mt-1 text-sm overflow-x-auto">
                      {step.code}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(step.code!, 'code-' + idx)}
                      className="absolute top-2 right-2 text-slate-400 hover:text-slate-200"
                    >
                      {copied === 'code-' + idx ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Payment Button Component */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">React Payment Button Component</h2>
        <div className="bg-slate-900 rounded-xl overflow-hidden">
          <div className="p-4 bg-slate-800 flex items-center justify-between">
            <span className="text-sm text-slate-300">Complete payment component</span>
            <button
              onClick={() => copyToClipboard(paymentButtonCode, 'payment-btn')}
              className="text-slate-400 hover:text-slate-200"
            >
              {copied === 'payment-btn' ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <pre className="p-4 text-slate-100 text-sm overflow-x-auto">
            {paymentButtonCode}
          </pre>
        </div>
      </div>

      {/* SDK Features */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Payment SDK Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sdkFeatures.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl">
              <CheckCircle2 size={20} className="text-green-500" />
              <span className="text-slate-700">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Next Steps */}
      <div className="flex items-center justify-between pt-8 border-t border-slate-200">
        <Link href="/docs/api/payments" className="text-slate-600 hover:text-slate-900">
          ← API Reference
        </Link>
        <Link href="/docs/integration/lms" className="btn btn-primary">
          LMS Integration →
        </Link>
      </div>
    </div>
  );
}

const paymentButtonCode = `import { useState } from 'react';

interface PaymentData {
  amount: number;
  currency: string;
  customer: {
    email: string;
    firstname: string;
    lastname: string;
    phone: string;
  };
  description: string;
}

export function PaymentButton({ data, apiKey }: { data: PaymentData; apiKey: string }) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          ...data,
          return_url: window.location.origin + '/payment/success',
          cancel_url: window.location.origin + '/payment/cancel'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        window.location.href = result.data.payment_url;
      } else {
        alert('Payment initialization failed');
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
    >
      {loading ? 'Processing...' : 'Pay Now'}
    </button>
  );
}`;
