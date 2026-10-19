import crypto from "node:crypto";

/**
 * Secret de signature des sessions (administration du PSP, espaces entreprises) — ADR-0018, D5.
 * Jamais de valeur de repli devinable :
 *  - production : sans JWT_SECRET (32 caractères au moins), le service refuse de démarrer ;
 *  - développement : secret aléatoire propre au processus (les sessions tombent au redémarrage), avec un avertissement ;
 *  - tests automatisés : valeur factice explicite.
 */
const TEST_SECRET = "test-only-jwt-secret-never-in-production-000";
let ephemeral = null;

export function jwtSecret(env = process.env) {
    const secret = env.JWT_SECRET;
    if (secret && secret.length >= 32) return secret;
    if (env.NODE_ENV === "test") return secret || TEST_SECRET;
    if (env.NODE_ENV === "production") {
        throw new Error("JWT_SECRET absent ou trop court (32 caractères minimum) : sessions impossibles à signer.");
    }
    if (!ephemeral) {
        ephemeral = crypto.randomBytes(48).toString("base64url");
        console.warn("[SÉCURITÉ] JWT_SECRET absent ou trop court : secret aléatoire de développement (sessions perdues au redémarrage).");
    }
    return ephemeral;
}

/** Contrôle au démarrage : en production, arrêt plutôt que signer avec un secret faible. */
export function assertJwtSecretConfigured(env = process.env) {
    jwtSecret(env);
}
