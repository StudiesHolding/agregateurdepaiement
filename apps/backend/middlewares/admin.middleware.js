import { ApiKeyService } from "../services/api-key.service.js";
import { AdminAuditLog } from "../models/admin-audit-log.model.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
import { catchAsync } from "./error.middleware.js";
import { jwtSecret } from "../utils/jwt-secret.js";
import { maskPayload, readSession } from "../utils/team-session.js";

/**
 * Accès à l'administration du PSP (ADR-0018, D5.2)
 * ================================================
 * Deux identités, jamais mélangées :
 *  - PERSONNE : session d'équipe (`Authorization: Bearer`), ouverte par la connexion Studies Learning ; elle porte
 *    l'identité du membre et ses permissions `psp.*`. Plus de clé partagée pour les personnes.
 *  - MACHINE : clé d'accès d'intégration (`X-API-Key`) dont le propriétaire commence par « admin: » ; accès complet,
 *    réservé aux scripts d'exploitation.
 */
export const protectAdmin = catchAsync(async (req, res, next) => {
    const apiKey = req.headers["x-api-key"];
    const authHeader = req.headers["authorization"];

    if (authHeader && authHeader.startsWith("Bearer ")) {
        const member = readSession(authHeader.slice(7), jwtSecret());
        if (!member) throw new UnauthorizedError("Session expirée ou invalide : reconnectez-vous depuis Studies Learning.");
        req.pspAdmin = { kind: "team", ...member };
        req.adminIdentifier = `sl:${member.id} ${member.email}`;
        req.adminEmail = member.email;
        return next();
    }

    if (apiKey) {
        const keyRecord = await ApiKeyService.findByKey(apiKey);
        if (!keyRecord || !keyRecord.isActive) throw new UnauthorizedError("Clé d'accès invalide.");
        if (!keyRecord.owner.startsWith("admin:")) throw new ForbiddenError("Privilèges insuffisants : clé d'intégration administrateur requise.");
        req.pspAdmin = { kind: "machine", id: keyRecord.id, email: keyRecord.email ?? null, name: keyRecord.owner, role: "machine", permissions: [] };
        req.adminIdentifier = keyRecord.owner;
        req.apiKeyId = keyRecord.id;
        req.adminEmail = keyRecord.email;
        return next();
    }

    throw new UnauthorizedError("Connexion requise : ouvrez l'administration depuis votre compte Studies Learning.");
});

/** Permission `psp.*` requise pour une personne ; une clé d'intégration administrateur passe toujours. */
export const requirePsp = (permission) => (req, res, next) => {
    if (req.pspAdmin?.kind === "machine") return next();
    if (req.pspAdmin?.kind === "team" && req.pspAdmin.permissions.includes(permission)) return next();
    next(new ForbiddenError("Votre compte n'a pas la permission nécessaire pour cette action."));
};

/**
 * Journal des actions sensibles (aggp_admin_audit_logs), écrit APRÈS la réponse avec son résultat (réussite, refus,
 * erreur) et le code HTTP. Le corps de la requête est masqué : identifiants des prestataires, jetons et secrets
 * n'y entrent jamais.
 *
 * @param {string} action - ex. 'TOGGLE_PROVIDER', 'UPDATE_ROUTE'
 * @param {string} targetType - ex. 'provider', 'route', 'webhook'
 */
export const auditLog = (action, targetType = null) => (req, res, next) => {
    res.on("finish", () => {
        const status = res.statusCode;
        AdminAuditLog.create({
            adminIdentifier: req.adminIdentifier || "inconnu",
            action,
            targetType,
            targetId: req.params?.id?.toString() || null,
            payload: {
                outcome: status < 400 ? "success" : status === 401 || status === 403 ? "denied" : "error",
                status,
                actorKind: req.pspAdmin?.kind ?? null,
                body: maskPayload(req.body ?? null),
                params: req.params,
            },
            ipAddress: req.ip || req.socket?.remoteAddress || null,
            userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500) || null,
        }).catch((err) => console.error("[AuditLog] écriture impossible :", err.message));
    });
    next();
};
