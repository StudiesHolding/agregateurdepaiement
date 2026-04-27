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
        payment_intent_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        provider_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        transaction_number: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM(...Object.values(AttemptStatus)),
            defaultValue: AttemptStatus.PENDING,
        },
        request_payload: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        response_payload: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        error_code: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        error_message: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "PaymentAttempt",
        tableName: "aggp_payment_attempts",
    }
);
