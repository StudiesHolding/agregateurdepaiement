import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";
import { jsonColumn } from "../utils/json-column.js";

export class PaymentProvider extends Model { }

PaymentProvider.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        code: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        supportCard: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        supportMobileMoney: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        apiEndpoint: {
            type: DataTypes.STRING(500),
            allowNull: true,
        },
        credentialsEncrypted: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
            ...jsonColumn("metadata"),
        },
    },
    {
        sequelize,
        modelName: "PaymentProvider",
        tableName: "aggp_payment_providers",
    }
);
