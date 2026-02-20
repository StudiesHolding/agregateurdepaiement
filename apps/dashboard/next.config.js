/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        // Server Actions enabled by default in Next.js 14
    },
    async rewrites() {
        return [
            {
                // Proxy API calls to the PSP backend during development
                source: "/api/psp/:path*",
                destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000"}/api/:path*`,
            },
        ];
    },
    images: {
        remotePatterns: [{ protocol: "https", hostname: "**" }],
    },
};

module.exports = nextConfig;
