import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

export class WebhookEvent extends Model { }

WebhookEvent.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        providerId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true,
        },
        eventType: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        eventId: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        payload: {
            type: DataTypes.JSON,
            allowNull: false,
        },
        signatureValid: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        processed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        processedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        errorMessage: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        retryCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
    },
    {
        sequelize,
        modelName: "WebhookEvent",
        tableName: "aggp_webhook_events",
        timestamps: true,
        updatedAt: false, // We only care about createdAt
        underscored: false, // Override global underscored setting to match camelCase database columns
    }
);
