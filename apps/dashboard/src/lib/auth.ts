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
            },
            async authorize(credentials) {
                if (!credentials?.apiKey) return null;

                const apiKey = credentials.apiKey as string;

                // In a simplified flow, we check if it starts with 'admin:'
                if (apiKey.startsWith("admin:")) {
                    return {
                        id: "admin-user",
                        name: "Super Admin",
                        email: "admin@studies-learning.com",
                        role: "admin",
                        apiKey: apiKey,
                    };
                }

                return null;
            },
        }),
    ],
});
