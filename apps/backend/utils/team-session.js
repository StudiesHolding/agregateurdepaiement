import jwt from "jsonwebtoken";

/**
 * Sessions de l'équipe Studies Learning sur l'administration du PSP (ADR-0018, D5.2)
 * ==================================================================================
 * 1. Le backend métier émet une ASSERTION courte (60 s, usage unique) pour un membre de l'équipe qui détient au
 *    moins une permission `psp.*` ; elle est signée par le secret partagé `PSP_SSO_SECRET`.
 * 2. Le PSP vérifie l'assertion (émetteur, audience, âge, identifiant unique jamais vu) puis ouvre une SESSION
 *    personnelle de 8 h, signée par son propre secret (`JWT_SECRET`), qui porte l'identité et les permissions.
 * Plus aucune clé partagée pour les personnes ; les clés d'accès restent réservées aux intégrations machine.
 */

export const PSP_PERMISSIONS = Object.freeze([
    "psp.view",
    "psp.providers.manage",
    "psp.operations.manage",
    "psp.companies.manage",
]);
const KNOWN = new Set(PSP_PERMISSIONS);

export const ASSERTION_ISSUER = "studies-learning";
export const ASSERTION_AUDIENCE = "sl-psp-admin";
export const SESSION_ISSUER = "sl-psp";
export const SESSION_AUDIENCE = "sl-psp-dashboard";
export const SESSION_TTL_SECONDS = 8 * 3600;
const ASSERTION_MAX_AGE_SECONDS = 120;

export class SsoError extends Error {
    constructor(code, message, status = 401) { super(message); this.code = code; this.status = status; }
}

/** Secret partagé avec le backend métier. Sans lui (ou trop court), la connexion de l'équipe est fermée. */
export function ssoSecret(env = process.env) {
    const s = env.PSP_SSO_SECRET;
    if (s && s.length >= 32) return s;
    if (env.NODE_ENV === "test") return s || "test-only-psp-sso-secret-never-in-production";
    return null;
}

/** Vérifie une assertion émise par le backend métier ; renvoie l'identité et les permissions `psp.*` reconnues. */
export function verifyAssertion(token, secret) {
    if (!secret) throw new SsoError("SSO_DISABLED", "Connexion de l'équipe indisponible : PSP_SSO_SECRET n'est pas configuré.", 503);
    if (typeof token !== "string" || token.length < 20 || token.length > 4096) throw new SsoError("INVALID_ASSERTION", "Assertion de connexion invalide.");
    let claims;
    try {
        claims = jwt.verify(token, secret, {
            algorithms: ["HS256"], issuer: ASSERTION_ISSUER, audience: ASSERTION_AUDIENCE,
            maxAge: `${ASSERTION_MAX_AGE_SECONDS}s`, clockTolerance: 5,
        });
    } catch (err) {
        throw new SsoError(err?.name === "TokenExpiredError" ? "ASSERTION_EXPIRED" : "INVALID_ASSERTION",
            err?.name === "TokenExpiredError" ? "Lien de connexion expiré : relancez l'ouverture depuis Studies Learning." : "Assertion de connexion invalide.");
    }
    const id = Number(claims.sub);
    if (!Number.isInteger(id) || id <= 0 || typeof claims.jti !== "string" || claims.jti.length < 16 || typeof claims.email !== "string") {
        throw new SsoError("INVALID_ASSERTION", "Assertion de connexion incomplète.");
    }
    const permissions = Array.isArray(claims.perms) ? [...new Set(claims.perms.filter((p) => KNOWN.has(p)))] : [];
    // Toute permission sur l'agrégateur suppose de pouvoir le consulter.
    if (permissions.length && !permissions.includes("psp.view")) permissions.unshift("psp.view");
    if (!permissions.length) throw new SsoError("NO_PSP_PERMISSION", "Votre compte n'a aucune permission sur l'agrégateur de paiement.", 403);
    return {
        jti: claims.jti, expiresAt: new Date(claims.exp * 1000),
        user: { id, email: claims.email, name: typeof claims.name === "string" && claims.name ? claims.name : claims.email, role: String(claims.role ?? "staff"), permissions },
    };
}

export function issueSession(user, secret) {
    const token = jwt.sign(
        { kind: "team", email: user.email, name: user.name, role: user.role, perms: user.permissions },
        secret,
        { algorithm: "HS256", subject: String(user.id), issuer: SESSION_ISSUER, audience: SESSION_AUDIENCE, expiresIn: SESSION_TTL_SECONDS },
    );
    return { token, expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000) };
}

/** Relit une session d'équipe ; null si le jeton n'en est pas une (ou est invalide, expiré). */
export function readSession(token, secret) {
    try {
        const c = jwt.verify(token, secret, { algorithms: ["HS256"], issuer: SESSION_ISSUER, audience: SESSION_AUDIENCE });
        if (c.kind !== "team") return null;
        return { id: Number(c.sub), email: c.email, name: c.name, role: c.role, permissions: (c.perms ?? []).filter((p) => KNOWN.has(p)) };
    } catch {
        return null;
    }
}

const SECRET_KEY = /pass(word)?|secret|token|api[_-]?key|private|credential|signature|otp|pin$|cvv|hash$/i;
const PARTIAL_KEY = /iban|account(_?number)?|card|phone|msisdn/i;

/** Masque récursivement ce qui ne doit jamais entrer dans le journal (identifiants des prestataires, jetons). */
export function maskPayload(value, key = "", depth = 0) {
    if (depth > 6) return "[profondeur]";
    if (value === null || value === undefined) return value ?? null;
    if (SECRET_KEY.test(key)) return "[masqué]";
    if (typeof value === "string") {
        if (PARTIAL_KEY.test(key) && value.length > 4) return `•••${value.slice(-4)}`;
        return value.length > 1000 ? `${value.slice(0, 1000)}…` : value;
    }
    if (Array.isArray(value)) return value.slice(0, 100).map((v) => maskPayload(v, key, depth + 1));
    if (typeof value === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = maskPayload(v, k, depth + 1);
        return out;
    }
    return value;
}
