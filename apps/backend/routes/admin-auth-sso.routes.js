import { Router } from "express";
import rateLimit from "express-rate-limit";
import { UniqueConstraintError } from "sequelize";
import { catchAsync } from "../middlewares/error.middleware.js";
import { AdminAuditLog, AdminSsoAssertion } from "../models/index.js";
import { jwtSecret } from "../utils/jwt-secret.js";
import { issueSession, ssoSecret, SsoError, verifyAssertion } from "../utils/team-session.js";

/**
 * Connexion de l'équipe Studies Learning (ADR-0018, D5.2)
 * `POST /api/admin/auth/sso/exchange` { assertion } → { user, token, expiresAt }
 * Appelé par le serveur du tableau de bord (jamais par le navigateur directement) avec l'assertion reçue du backend
 * métier. Toute tentative, réussie ou non, est journalisée.
 */
const router = Router();
const limiter = process.env.NODE_ENV === "test" ? (_req, _res, next) => next() : rateLimit({ windowMs: 15 * 60_000, max: 30, standardHeaders: true, legacyHeaders: false });

const journal = (req, identifier, action, payload) => AdminAuditLog.create({
    adminIdentifier: identifier, action, targetType: "session", targetId: null, payload,
    ipAddress: req.ip ?? null, userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500) || null,
}).catch((err) => console.error("[sso] journal indisponible :", err.message));

router.post("/exchange", limiter, catchAsync(async (req, res) => {
    try {
        const { jti, expiresAt, user } = verifyAssertion(req.body?.assertion, ssoSecret());
        try {
            await AdminSsoAssertion.create({ jti, userId: user.id, expiresAt, ipAddress: req.ip ?? null });
        } catch (err) {
            if (err instanceof UniqueConstraintError) throw new SsoError("ASSERTION_REPLAYED", "Ce lien de connexion a déjà servi : relancez l'ouverture depuis Studies Learning.");
            throw err;
        }
        const session = issueSession(user, jwtSecret());
        await journal(req, `sl:${user.id} ${user.email}`, "SSO_LOGIN", { role: user.role, permissions: user.permissions });
        res.json({ status: "success", user, token: session.token, expiresAt: session.expiresAt.toISOString() });
    } catch (err) {
        if (!(err instanceof SsoError)) throw err;
        await journal(req, "anonyme", "SSO_LOGIN_REFUSED", { code: err.code });
        res.status(err.status).json({ status: "error", code: err.code, message: err.message });
    }
}));

export default router;
