import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible Auth.js Configuration
 * This file contains the core configuration that can run in the 
 * Next.js Middleware (Edge Runtime).
 */
export const authConfig = {
    providers: [], // Providers are added in the main auth.ts
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
                token.apiKey = (user as any).apiKey;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role;
                (session.user as any).apiKey = token.apiKey;
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
        maxAge: 12 * 60 * 60, // 12 hours
    },
    pages: {
        signIn: "/login",
    },
} satisfies NextAuthConfig;
