/** @type {import('next').NextConfig} */
const withNextIntl = require("next-intl/plugin")("./src/i18n.ts");

const nextConfig = {
  // Port 3002 to avoid conflicts with dashboard (3001) and backend (3000)
  // Run with: next dev --port 3002
};

module.exports = withNextIntl(nextConfig);
