import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";
import { jsonColumn } from "../utils/json-column.js";

/** Règle de notification de l'espace finance (ADR-0019, D7). */
export class NotificationRule extends Model { }

NotificationRule.init(
    {
        id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        event: { type: DataTypes.STRING(60), allowNull: false },
        name: { type: DataTypes.STRING(120), allowNull: true },
        enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        severity: { type: DataTypes.ENUM("info", "warning", "danger"), allowNull: false, defaultValue: "info" },
        params: { type: DataTypes.JSON, allowNull: true, ...jsonColumn("params") },
        channels: { type: DataTypes.JSON, allowNull: false, ...jsonColumn("channels") },
        recipients: { type: DataTypes.JSON, allowNull: true, ...jsonColumn("recipients") },
        quietHours: { type: DataTypes.JSON, allowNull: true, ...jsonColumn("quietHours") },
        timezone: { type: DataTypes.STRING(60), allowNull: false, defaultValue: "Africa/Douala" },
        cooldownMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 60 },
        updatedBy: { type: DataTypes.STRING(255), allowNull: true },
    },
    { sequelize, modelName: "NotificationRule", tableName: "aggp_notification_rules", underscored: true },
);
