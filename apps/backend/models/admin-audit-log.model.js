import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

/**
 * Admin Audit Log — tracks every sensitive admin action
 * (toggle provider, modify route, replay webhook, etc.)
 */
export class AdminAuditLog extends Model { }

AdminAuditLog.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        // Who performed the action
        adminIdentifier: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: "API key owner or admin email",
        },
        // What was the action
        action: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: "e.g. TOGGLE_PROVIDER, UPDATE_ROUTE, REPLAY_WEBHOOK",
        },
        // What resource was affected
        targetType: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: "e.g. provider, route, webhook",
        },
        targetId: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        // Payload (what changed)
        payload: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        // Network context
        ipAddress: {
            type: DataTypes.STRING(45),
            allowNull: true,
        },
        userAgent: {
            type: DataTypes.STRING(500),
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "AdminAuditLog",
        tableName: "aggp_admin_audit_logs",
        updatedAt: false, // Immutable records
    }
);
