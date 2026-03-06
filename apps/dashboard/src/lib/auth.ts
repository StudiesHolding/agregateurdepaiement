import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

/**
 * NextAuth Configuration — Studies PSP Dashboard
 * This file adds Node-only providers (like Credentials) to the base configuration.
 */
export const {
    handlers: { GET, POST },
    auth,
    signIn,
    signOut,
} = NextAuth({
    ...authConfig,
    providers: [
        CredentialsProvider({
            name: "Admin Access",
            credentials: {
                apiKey: { label: "Admin API Key", type: "password" },
                otp: { label: "OTP", type: "text" },
            },
            async authorize(credentials) {
                if (!credentials?.apiKey || !credentials?.otp) return null;

                try {
                    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
                    const res = await fetch(`${apiBase}/api/admin/auth/2fa/verify`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            apiKey: credentials.apiKey,
                            otp: credentials.otp
                        }),
                    });

                    const data = await res.json();

                    if (data.status === "success" && data.user) {
                        return {
                            ...data.user,
                            apiKey: credentials.apiKey,
                            token: data.token
                        };
                    }
                } catch (err) {
                    console.error("[Auth] 2FA verification failed:", err);
                }

                return null;
            },
        }),
    ],
});
