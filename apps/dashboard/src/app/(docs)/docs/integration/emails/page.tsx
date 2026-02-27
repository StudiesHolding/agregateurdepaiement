"use client";

import { Mail, FileText, Send, CreditCard, User, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const emailTemplates = [
  {
    name: "Payment Confirmation",
    trigger: "Payment approved via webhook",
    icon: CreditCard,
    subject: "Confirmation de paiement - Studies Learning",
    description: "Sent when payment is confirmed by the provider"
  },
  {
    name: "Order Validation",
    trigger: "Admin validates order in dashboard",
    icon: CheckCircle2,
    subject: "Votre commande a été validée",
    description: "Sent when admin validates the order"
  },
  {
    name: "LMS Access Granted",
    trigger: "Admin sends LMS access",
    icon: User,
    subject: "Vos accès formations - Studies Learning",
    description: "Contains WordPress login credentials"
  },
  {
    name: "Order Rejection",
    trigger: "Admin rejects order",
    icon: Mail,
    subject: "Commande refusée - Studies Learning",
    description: "Sent when payment cannot be validated"
  }
];

const emailFeatures = [
  "HTML email templates with inline styles",
  "PDF invoice attachment",
  "Automatic language detection (FR/EN)",
  "Responsive design for mobile",
  "Track email opens and clicks"
];

export default function EmailsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">Email Templates</h1>
        <p className="text-lg text-slate-600">
          Overview of email templates and notification system.
        </p>
      </div>

      {/* Email Overview */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
        <h2 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
          <Mail size={20} />
          Email Notification System
        </h2>
        <p className="text-blue-800 mb-4">
          The payment aggregator sends automated transactional emails at key moments in the order lifecycle.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">4</div>
            <div className="text-xs text-slate-500">Email Types</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">PDF</div>
            <div className="text-xs text-slate-500">Invoice</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">2</div>
            <div className="text-xs text-slate-500">Languages</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">24/7</div>
            <div className="text-xs text-slate-500">Monitoring</div>
          </div>
        </div>
      </div>

      {/* Email Templates */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Email Templates</h2>
        <div className="space-y-4">
          {emailTemplates.map((template, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-3">
                <template.icon size={24} className="text-primary" />
                <h3 className="font-bold text-slate-900">{template.name}</h3>
              </div>
              <p className="text-slate-600 mb-2">{template.description}</p>
              <div className="text-sm">
                <span className="text-slate-500">Trigger: </span>
                <code className="bg-slate-100 px-2 py-1 rounded text-primary">{template.trigger}</code>
              </div>
              <div className="mt-2 text-sm">
                <span className="text-slate-500">Subject: </span>
                <span className="text-slate-700">{template.subject}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email Features */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {emailFeatures.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl">
              <CheckCircle2 size={20} className="text-green-500" />
              <span className="text-slate-700">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">SMTP Configuration</h2>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-slate-600 mb-4">
            Configure your SMTP settings in the environment variables:
          </p>
          <div className="bg-slate-900 rounded-lg p-4">
            <pre className="text-slate-100 text-sm">
{`# Email (SMTP)
MAIL_HOST=smtp.ionos.fr
MAIL_PORT=587
MAIL_USER=no-reply@domain.com
MAIL_PASS=your_password
MAIL_FROM=Studies Learning <no-reply@domain.com>`}
            </pre>
          </div>
        </div>
      </div>

      {/* Testing */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Testing Emails</h2>
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-slate-600 mb-4">
            Test your email configuration with the built-in test script:
          </p>
          <div className="bg-slate-900 rounded-lg p-4">
            <pre className="text-slate-100 text-sm">
{`cd apps/backend
node scripts/test-email.js`}
            </pre>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="flex items-center justify-between pt-8 border-t border-slate-200">
        <Link href="/docs/integration/lms" className="text-slate-600 hover:text-slate-900">
          ← LMS Integration
        </Link>
        <Link href="/docs/deployment/vps" className="btn btn-primary">
          Deployment →
        </Link>
      </div>
    </div>
  );
}
