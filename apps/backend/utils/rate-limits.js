import crypto from "node:crypto";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * Limites de débit par type d'appelant (ADR-0019, D6)
 * ===================================================
 * Une limite unique par adresse IP était dangereuse : tous les paiements créés par le purchase-engine, tous les
 * appels du tableau de bord (relayés par son serveur) et tous les webhooks d'un prestataire partagent chacun UNE
 * adresse. 100 requêtes / 15 min suffisaient à bloquer l'équipe, à refuser des paiements et des confirmations.
 *  - personnes (session d'équipe) : par session ;
 *  - intégrations (clé d'API) : par clé ;
 *  - prestataires (webhooks) : par IP, très large — la signature protège, une confirmation ne doit jamais être perdue ;
 *  - routes publiques : par IP réelle du client (trust proxy).
 */
const digest = (v) => crypto.createHash("sha256").update(String(v)).digest("hex").slice(0, 32);

export function callerKey(req) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) return `session:${digest(auth.slice(7))}`;
    const key = req.headers["x-api-key"];
    if (key) return `key:${digest(key)}`;
    return `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

const message = (what) => ({ status: "fail", code: "RATE_LIMITED", message: `Trop de requêtes (${what}). Réessayez dans un instant.` });

export function buildRateLimits(env = process.env) {
    if (env.NODE_ENV === "test") return null;
    const common = { standardHeaders: true, legacyHeaders: false };
    return {
        admin: rateLimit({ ...common, windowMs: 60_000, max: 600, keyGenerator: callerKey, message: message("administration") }),
        machine: rateLimit({ ...common, windowMs: 60_000, max: 1200, keyGenerator: callerKey, message: message("intégration") }),
        webhooks: rateLimit({ ...common, windowMs: 60_000, max: 3000, keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""), message: message("webhooks") }),
        public: rateLimit({ ...common, windowMs: 15 * 60_000, max: 300, keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""), message: message("adresse") }),
    };
}
