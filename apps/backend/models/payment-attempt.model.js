import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";
import { AttemptStatus } from "../enums/index.js";

export class PaymentAttempt extends Model { }

PaymentAttempt.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        paymentIntentId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        providerId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        transactionNumber: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM(...Object.values(AttemptStatus)),
            defaultValue: AttemptStatus.PENDING,
        },
        requestPayload: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        responsePayload: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        errorCode: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        errorMessage: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "PaymentAttempt",
        tableName: "aggp_payment_attempts",
        underscored: false, // Override global underscored setting to match camelCase database columns
    }
);
