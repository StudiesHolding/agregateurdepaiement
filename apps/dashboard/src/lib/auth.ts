import NextAuth, { CredentialsSignin } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

/**
 * Connexion à l'administration du PSP (ADR-0018, D5.2)
 * Un seul fournisseur : l'assertion émise par Studies Learning pour un membre de l'équipe, échangée côté serveur
 * contre une session personnelle du PSP. Plus de clé d'accès partagée ni de code par e-mail.
 */
class SsoRefused extends CredentialsSignin {
    constructor(code: string) { super(); this.code = code; }
}

const PSP_API = process.env.PSP_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export const {
    handlers: { GET, POST },
    auth,
    signIn,
    signOut,
} = NextAuth({
    ...authConfig,
    providers: [
        CredentialsProvider({
            id: "sl-sso",
            name: "Studies Learning",
            credentials: { assertion: { type: "text" } },
            async authorize(credentials) {
                const assertion = typeof credentials?.assertion === "string" ? credentials.assertion : "";
                if (!assertion) throw new SsoRefused("INVALID_ASSERTION");
                let res: Response;
                try {
                    res = await fetch(`${PSP_API}/api/admin/auth/sso/exchange`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ assertion }),
                        cache: "no-store",
                    });
                } catch {
                    throw new SsoRefused("PSP_UNREACHABLE");
                }
                const data = await res.json().catch(() => ({}));
                if (!res.ok || data.status !== "success" || !data.token) throw new SsoRefused(String(data.code ?? "INVALID_ASSERTION"));
                // Le jeton du PSP reste dans le cookie chiffré de session, jamais exposé au navigateur.
                return {
                    id: String(data.user.id), email: data.user.email, name: data.user.name,
                    role: data.user.role, permissions: data.user.permissions, backendToken: data.token,
                };
            },
        }),
    ],
});
