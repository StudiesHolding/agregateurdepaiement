import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";
import { jsonColumn } from "../utils/json-column.js";

/** Journal d'envoi des notifications (ADR-0019, D7) : chaque canal, chaque destinataire, avec son issue. */
export class NotificationDelivery extends Model { }

NotificationDelivery.init(
    {
        id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        ruleId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        event: { type: DataTypes.STRING(60), allowNull: false },
        dedupeKey: { type: DataTypes.STRING(190), allowNull: false },
        channel: { type: DataTypes.ENUM("inApp", "email", "sound"), allowNull: false },
        recipient: { type: DataTypes.STRING(255), allowNull: true },
        status: { type: DataTypes.ENUM("sent", "skipped", "failed"), allowNull: false },
        title: { type: DataTypes.STRING(255), allowNull: false },
        detail: { type: DataTypes.STRING(500), allowNull: true },
        payload: { type: DataTypes.JSON, allowNull: true, ...jsonColumn("payload") },
    },
    { sequelize, modelName: "NotificationDelivery", tableName: "aggp_notification_deliveries", underscored: true, updatedAt: false },
);
