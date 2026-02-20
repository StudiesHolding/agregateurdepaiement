import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

/**
 * NextAuth Configuration — Studies PSP Dashboard
 * Uses a simple Credentials provider for Admin API Key based entry.
 * In a production scenario, this would link to the LMS OAuth or a session-based auth.
 */
export const {
    handlers: { GET, POST },
    auth,
    signIn,
    signOut,
} = NextAuth({
    providers: [
        CredentialsProvider({
            name: "Admin Access",
            credentials: {
                apiKey: { label: "Admin API Key", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.apiKey) return null;

                const apiKey = credentials.apiKey as string;

                // In a real flow, we would call the backend to validate the key
                // For now, we check if it starts with 'admin:' as per our RBAC rule
                if (apiKey.startsWith("admin:")) {
                    return {
                        id: "admin-user",
                        name: "Super Admin",
                        email: "admin@studies-learning.com",
                        role: "admin",
                        apiKey: apiKey, // Pass the key to the session
                    };
                }

                return null;
            },
        }),
    ],
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
    pages: {
        signIn: "/login",
    },
});
