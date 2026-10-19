import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

/**
 * Assertions de connexion déjà utilisées (ADR-0018, D5.2) : chaque assertion émise par le backend métier n'ouvre
 * qu'une session. La clé primaire sur `jti` rend le rejeu impossible, même entre plusieurs instances.
 */
export class AdminSsoAssertion extends Model { }

AdminSsoAssertion.init(
    {
        jti: { type: DataTypes.STRING(64), primaryKey: true },
        userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "user_id" },
        expiresAt: { type: DataTypes.DATE, allowNull: false, field: "expires_at" },
        ipAddress: { type: DataTypes.STRING(45), allowNull: true, field: "ip_address" },
    },
    { sequelize, modelName: "AdminSsoAssertion", tableName: "aggp_admin_sso_assertions", createdAt: "used_at", updatedAt: false, underscored: true },
);
