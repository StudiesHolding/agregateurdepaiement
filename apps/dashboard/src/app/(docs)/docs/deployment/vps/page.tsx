"use client";

import { useState } from "react";
import { Copy, CheckCircle2, Server, Shield, Globe, Database, Mail, Terminal } from "lucide-react";
import Link from "next/link";

const serverConfig = {
  os: "Ubuntu 22.04 LTS",
  node: "v18+",
  mysql: "8.0+",
  nginx: "latest"
};

const envVars = [
  { name: "DATABASE_HOST", description: "MySQL server hostname", example: "localhost" },
  { name: "DATABASE_PORT", description: "MySQL port", example: "3306" },
  { name: "DATABASE_NAME", description: "Database name", example: "payment_db" },
  { name: "DATABASE_USER", description: "Database username", example: "app_user" },
  { name: "DATABASE_PASSWORD", description: "Database password (use secrets manager)", example: "***" },
  { name: "CINETPAY_API_KEY", description: "CinetPay API key", example: "***" },
  { name: "CINETPAY_SITE_ID", description: "CinetPay site ID", example: "123456" },
  { name: "STRIPE_SECRET_KEY", description: "Stripe secret key", example: "sk_live_***" },
  { name: "KKIAPAY_SECRET_KEY", description: "KKiaPay secret key", example: "sk_***" },
  { name: "MAIL_HOST", description: "SMTP server", example: "smtp.ionos.fr" },
  { name: "MAIL_USER", description: "SMTP username", example: "no-reply@domain.com" },
  { name: "MAIL_PASS", description: "SMTP password (use secrets manager)", example: "***" },
  { name: "JWT_SECRET", description: "JWT signing secret (min 32 chars)", example: "***" },
  { name: "ADMIN_MASTER_KEY", description: "Admin master key", example: "admin:***" }
];

const steps = [
  {
    title: "1. Server Setup",
    description: "Create a VPS instance and install dependencies",
    code: `# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server

# Install Nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2`
  },
  {
    title: "2. Database Setup",
    description: "Create MySQL database and user",
    code: `sudo mysql

# Create database
CREATE DATABASE payment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Create user
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'strong_password';

# Grant privileges
GRANT ALL PRIVILEGES ON payment_db.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;`
  },
  {
    title: "3. Application Setup",
    description: "Deploy the application code",
    code: `# Clone repository
git clone https://github.com/StudiesHolding/agregateurdepaiement.git
cd agregateurdepaisie

# Install backend dependencies
cd apps/backend
npm install --production

# Create production .env file
cp .env.example .env
nano .env  # Edit with production values`
  },
  {
    title: "4. Run Migrations",
    description: "Set up database schema",
    code: `# Run migrations
mysql -u app_user -p payment_db < apps/backend/scripts/migration-fix-missing-columns.sql

# Or use Sequelize CLI
cd apps/backend
npx sequelize db:migrate`
  },
  {
    title: "5. Nginx Configuration",
    description: "Configure Nginx as reverse proxy",
    code: `sudo nano /etc/nginx/sites-available/payment-api

# Add configuration
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/payment-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx`
  },
  {
    title: "6. Start Application",
    description: "Start the backend with PM2",
    code: `# Start backend
cd apps/backend
pm2 start server.js --name payment-api

# Start dashboard (separate port)
cd ../dashboard
pm2 start npm --name payment-dashboard -- start

# Save PM2 configuration
pm2 save

# Setup startup script
sudo pm2 startup`
  },
  {
    title: "7. SSL Certificate (Production)",
    description: "Secure the connection with HTTPS",
    code: `# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is automatic`
  }
];

export default function VPSDeploymentPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 mb-4">VPS Deployment Guide</h1>
        <p className="text-lg text-slate-600">
          Complete guide to deploying the payment aggregator on a production VPS.
        </p>
      </div>

      {/* Server Requirements */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
          <Server size={24} className="mx-auto text-primary mb-2" />
          <div className="font-bold text-slate-900">{serverConfig.os}</div>
          <div className="text-sm text-slate-500">Operating System</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
          <Terminal size={24} className="mx-auto text-primary mb-2" />
          <div className="font-bold text-slate-900">Node.js {serverConfig.node}</div>
          <div className="text-sm text-slate-500">Runtime</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
          <Database size={24} className="mx-auto text-primary mb-2" />
          <div className="font-bold text-slate-900">MySQL {serverConfig.mysql}</div>
          <div className="text-sm text-slate-500">Database</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
          <Globe size={24} className="mx-auto text-primary mb-2" />
          <div className="font-bold text-slate-900">Nginx</div>
          <div className="text-sm text-slate-500">Reverse Proxy</div>
        </div>
      </div>

      {/* Environment Variables */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Environment Variables</h2>
        <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left p-2">Variable</th>
                <th className="text-left p-2">Description</th>
                <th className="text-left p-2">Example</th>
              </tr>
            </thead>
            <tbody>
              {envVars.map((v) => (
                <tr key={v.name} className="border-b border-slate-800">
                  <td className="p-2 font-mono text-primary">{v.name}</td>
                  <td className="p-2 text-slate-300">{v.description}</td>
                  <td className="p-2 font-mono text-slate-500">{v.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deployment Steps */}
      <div className="space-y-6">
        {steps.map((step, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">{step.title}</h3>
              <p className="text-sm text-slate-500">{step.description}</p>
            </div>
            <div className="p-4">
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => copyToClipboard(step.code, 'step-' + idx)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  {copied === 'step-' + idx ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">
                {step.code}
              </pre>
            </div>
          </div>
        ))}
      </div>

      {/* Security Checklist */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h2 className="font-bold text-red-900 mb-4 flex items-center gap-2">
          <Shield size={20} />
          Security Checklist
        </h2>
        <ul className="space-y-2 text-sm text-red-800">
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} /> Change all default passwords
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} /> Use strong JWT_SECRET (min 32 random characters)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} /> Enable SSL/HTTPS in production
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} /> Configure firewall (ufw): allow ports 22, 80, 443
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} /> Disable root login via SSH
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} /> Set up fail2ban for SSH protection
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 size={16} /> Use secrets manager for production credentials
          </li>
        </ul>
      </div>

      {/* Next Steps */}
      <div className="flex items-center justify-between pt-8 border-t border-slate-200">
        <Link href="/docs/quick-start" className="text-slate-600 hover:text-slate-900">
          ← Quick Start
        </Link>
        <Link href="/docs/deployment/security" className="btn btn-primary">
          Security →
        </Link>
      </div>
    </div>
  );
}
