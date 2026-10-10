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
                // Jeton de session du backend : reste dans le cookie chiffré, jamais exposé au navigateur.
                token.backendToken = (user as any).backendToken;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role;
            }
            return session;
        },
    },
    session: {
        strategy: "jwt",
        maxAge: 8 * 60 * 60, // 8 h, comme le jeton du backend
    },
    pages: {
        signIn: "/login",
    },
} satisfies NextAuthConfig;
