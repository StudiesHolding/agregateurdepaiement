import { ApiKeyService } from "../services/api-key.service.js";
import { AdminAuditLog } from "../models/admin-audit-log.model.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
import { catchAsync } from "./error.middleware.js";
import jwt from "jsonwebtoken";

/**
 * Admin API Key protection middleware.
 * Checks that the request has a valid API Key AND that the key
 * owner is flagged as an admin (owner field starts with "admin:" prefix).
 * 
 * Convention: Admin API keys have owner = "admin:<name>"
 * Regular API keys have owner = "app:<name>" or just "<name>"
 */
export const protectAdmin = catchAsync(async (req, res, next) => {
    let apiKey = req.headers["x-api-key"] || req.headers["X-API-KEY"];
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];

    // 1. Try JWT Bearer Token
    if (!apiKey && authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
            apiKey = decoded.apiKey;
        } catch (err) {
            throw new UnauthorizedError("Session expirée ou token invalide. Veuillez vous reconnecter.");
        }
    }

    if (!apiKey) {
        throw new UnauthorizedError("Admin access requires an API Key or active session");
    }

    const keyRecord = await ApiKeyService.findByKey(apiKey);

    if (!keyRecord || !keyRecord.isActive) {
        throw new UnauthorizedError("Session ou clé d'accès invalide. Veuillez vous reconnecter.");
    }

    // Check admin privilege: owner must be prefixed with "admin:"
    if (!keyRecord.owner.startsWith("admin:")) {
        throw new ForbiddenError(
            "Privilèges insuffisants. L'accès administrateur est requis."
        );
    }

    // Attach identity to the request for audit logging
    req.adminIdentifier = keyRecord.owner;
    req.apiKeyId = keyRecord.id;

    next();
});

/**
 * Audit Logging Middleware
 * Records a sensitive admin action to aggp_admin_audit_logs.
 * Call this AFTER the action has been performed.
 * 
 * @param {string} action - e.g. 'TOGGLE_PROVIDER', 'UPDATE_ROUTE'
 * @param {string} targetType - e.g. 'provider', 'route', 'webhook'
 */
export const auditLog = (action, targetType = null) => {
    return async (req, res, next) => {
        // We don't block the request for audit failures — log and continue
        try {
            await AdminAuditLog.create({
                adminIdentifier: req.adminIdentifier || "unknown",
                action,
                targetType,
                targetId: req.params?.id?.toString() || null,
                payload: {
                    body: req.body,
                    params: req.params,
                },
                ipAddress: req.ip || req.connection?.remoteAddress,
                userAgent: req.headers["user-agent"],
            });
        } catch (err) {
            console.error("[AuditLog] Failed to write audit log:", err.message);
        }
        next();
    };
};
