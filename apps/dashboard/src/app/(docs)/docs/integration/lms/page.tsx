"use client";

import {
  BookOpen,
  Settings,
  Users,
  CheckCircle2,
  ExternalLink,
  CreditCard,
  Link2,
  CheckCircle,
  GraduationCap,
  Mail
} from "lucide-react";
import Link from "next/link";

const workflowSteps = [
  {
    step: 1,
    title: "Customer Makes Payment",
    description:
      "Customer completes payment on your site using the payment aggregator",
    icon: CreditCard,
  },
  {
    step: 2,
    title: "Webhook Received",
    description: "Backend receives payment confirmation webhook from provider",
    icon: Link2,
  },
  {
    step: 3,
    title: "Order Validated",
    description: "Admin reviews and validates the order in the dashboard",
    icon: CheckCircle,
  },
  {
    step: 4,
    title: "LMS Access Granted",
    description:
      "System automatically creates WordPress user and enrolls in course",
    icon: GraduationCap,
  },
  {
    step: 5,
    title: "Credentials Sent",
    description: "Email sent to customer with WordPress login credentials",
    icon: Mail,
  },
];

const lmsConfig = [
  {
    field: "LMS_BRIDGE_URL",
    description: "WordPress site URL",
    example: "https://yoursite.com",
  },
  {
    field: "LMS_BRIDGE_USERNAME",
    description: "WordPress admin username",
    example: "admin",
  },
  {
    field: "LMS_BRIDGE_PASSWORD",
    description: "WordPress application password",
    example: "***",
  },
  {
    field: "LMS_DEFAULT_ROLE",
    description: "Role for new users (default: subscriber)",
    example: "subscriber",
  },
];

const adminActions = [
  {
    status: "payment_confirmed",
    actions: ["Validate Order", "Reject Order"],
    description: "Admin reviews payment proof and validates",
  },
  {
    status: "validated",
    actions: ["Send LMS Access"],
    description: "System creates WP user and enrolls in course",
  },
  {
    status: "completed",
    actions: [],
    description: "Order complete - access granted",
  },
];

export default function LMSIntegrationPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">
          LMS Integration
        </h1>
        <p className="text-lg text-slate-600">
          Complete guide to integrating with WordPress/LearnPress LMS for
          automatic course enrollment.
        </p>
      </div>

      {/* Overview */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6">
        <h2 className="font-bold text-green-900 mb-4 flex items-center gap-2">
          <BookOpen size={20} />
          How It Works
        </h2>
        <p className="text-green-800">
          When a customer purchases a course, the payment aggregator
          automatically:
        </p>
        <ul className="mt-3 space-y-2 text-green-700">
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} /> Validates the payment
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} /> Creates a WordPress user account
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} /> Enrolls the user in the purchased course
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} /> Sends login credentials via email
          </li>
        </ul>
      </div>

      {/* Workflow Steps */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Order Workflow
        </h2>
        <div className="space-y-4">
          {workflowSteps.map((item, idx) => (
            <div key={idx} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                  {item.step}
                </div>
                {idx < workflowSteps.length - 1 && (
                  <div className="w-0.5 h-12 bg-slate-200" />
                )}
              </div>
              <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <item.icon size={20} className="text-primary" />
                  <h3 className="font-bold text-slate-900">{item.title}</h3>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          WordPress Configuration
        </h2>
        <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left p-2">Environment Variable</th>
                <th className="text-left p-2">Description</th>
                <th className="text-left p-2">Example</th>
              </tr>
            </thead>
            <tbody>
              {lmsConfig.map((config, idx) => (
                <tr key={idx} className="border-b border-slate-800">
                  <td className="p-2 font-mono text-primary">{config.field}</td>
                  <td className="p-2 text-slate-300">{config.description}</td>
                  <td className="p-2 font-mono text-slate-500">
                    {config.example}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* WordPress Setup */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          WordPress Setup Guide
        </h2>
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-bold text-slate-900 mb-2">
              1. Install LearnPress
            </h3>
            <p className="text-slate-600 text-sm">
              Install and configure LearnPress plugin on your WordPress site.
              Create courses with pricing.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-bold text-slate-900 mb-2">
              2. Create Application Password
            </h3>
            <p className="text-slate-600 text-sm">
              Go to Users → Profile → Application Passwords. Create a new
              password with name "Payment Aggregator".
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-bold text-slate-900 mb-2">
              3. Enable REST API
            </h3>
            <p className="text-slate-600 text-sm">
              Ensure WordPress REST API is enabled. LearnPress provides
              endpoints for user creation and course enrollment.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-bold text-slate-900 mb-2">
              4. Configure Environment
            </h3>
            <p className="text-slate-600 text-sm">
              Add the LMS configuration variables to your backend .env file.
            </p>
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          Admin Dashboard Actions
        </h2>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3 font-bold text-slate-900">
                  Order Status
                </th>
                <th className="text-left p-3 font-bold text-slate-900">
                  Available Actions
                </th>
                <th className="text-left p-3 font-bold text-slate-900">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {adminActions.map((action, idx) => (
                <tr key={idx} className="border-t border-slate-200">
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${action.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : action.status === "validated"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                    >
                      {action.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {action.actions.length > 0 ? (
                      <div className="flex gap-2">
                        {action.actions.map((a, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-slate-100 rounded text-xs"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-600 text-sm">
                    {action.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* API Reference */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">
          LMS Bridge API
        </h2>
        <div className="bg-slate-900 rounded-xl p-4">
          <h3 className="font-bold text-slate-100 mb-3">Create User</h3>
          <code className="block text-sm text-slate-300 mb-2">
            POST /wp-json/lms/v1/users
          </code>
          <pre className="text-sm text-slate-400">
            {`{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "auto-generated",
  "first_name": "John",
  "last_name": "Doe"
}`}
          </pre>
        </div>
        <div className="bg-slate-900 rounded-xl p-4 mt-4">
          <h3 className="font-bold text-slate-100 mb-3">Enroll in Course</h3>
          <code className="block text-sm text-slate-300 mb-2">
            POST /wp-json/learnpress/v1/courses/[course_id]/enroll
          </code>
          <pre className="text-sm text-slate-400">
            {`{
  "user_id": 123,
  "order_id": "ORD-2026-001"
}`}
          </pre>
        </div>
      </div>

      {/* Next Steps */}
      <div className="flex items-center justify-between pt-8 border-t border-slate-200">
        <Link
          href="/docs/integration/frontend"
          className="text-slate-600 hover:text-slate-900"
        >
          ← Frontend Integration
        </Link>
        <Link href="/docs/deployment/vps" className="btn btn-primary">
          Deployment →
        </Link>
      </div>
    </div>
  );
}
