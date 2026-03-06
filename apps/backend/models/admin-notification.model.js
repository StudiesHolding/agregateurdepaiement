import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

/**
 * AdminNotification - Stores in-app alerts for administrators
 */
export class AdminNotification extends Model { }

AdminNotification.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        type: {
            type: DataTypes.ENUM("SUCCESS", "DANGER", "WARNING", "INFO"),
            defaultValue: "INFO",
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        orderReference: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: "order_reference",
        },
        isRead: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: "is_read",
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "AdminNotification",
        tableName: "aggp_admin_notifications",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    }
);
