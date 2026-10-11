import { NextResponse, type NextRequest } from "next/server";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

/**
 * Retour de connexion Studies Learning (ADR-0018, D5.2)
 * Le navigateur du membre poste ici l'assertion émise par le backend métier (liaison POST : jamais dans l'adresse).
 * Seule l'administration Studies Learning est admise comme origine ; l'assertion est ensuite vérifiée par le PSP.
 */
const allowedOrigins = () => (process.env.SL_ADMIN_ORIGINS || "http://localhost:3004")
    .split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);

const toLogin = (req: NextRequest, code: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(code)}`, req.url), 303);

export async function POST(req: NextRequest) {
    const origin = req.headers.get("origin");
    if (origin && !allowedOrigins().includes(origin.replace(/\/$/, ""))) return toLogin(req, "UNTRUSTED_ORIGIN");
    const form = await req.formData().catch(() => null);
    const assertion = form?.get("assertion");
    if (typeof assertion !== "string" || !assertion) return toLogin(req, "INVALID_ASSERTION");
    try {
        // Sans redirection, un refus ne lève pas toujours : l'adresse renvoyée porte alors l'erreur.
        const result = await signIn("sl-sso", { assertion, redirect: false });
        const failed = typeof result === "string" && /[?&]error=/.test(result);
        if (failed) return toLogin(req, new URL(result, req.url).searchParams.get("code") || "INVALID_ASSERTION");
    } catch (err) {
        if (err instanceof AuthError) return toLogin(req, (err as AuthError & { code?: string }).code || "INVALID_ASSERTION");
        throw err;
    }
    return NextResponse.redirect(new URL("/", req.url), 303);
}

/**
 * Ouverture sans assertion (onglet rechargé, rouvert ou fenêtre surgissante débloquée après coup) : le navigateur
 * repart en GET et l'assertion, à usage unique, n'existe plus. On explique au lieu d'afficher une page vide.
 */
export function GET(req: NextRequest) {
    return toLogin(req, "SSO_RELAUNCH");
}
