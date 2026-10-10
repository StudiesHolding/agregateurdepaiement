import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";
import { jsonColumn } from "../utils/json-column.js";

export class ProviderRoute extends Model { }

ProviderRoute.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        providerId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        countryCode: {
            type: DataTypes.STRING(10),
            allowNull: false,
        },
        currency: {
            type: DataTypes.STRING(10),
            allowNull: false,
        },
        minAmount: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
        },
        maxAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true,
        },
        // Moyen de paiement couvert par la règle (ADR-0019, D2) : « any » = carte et Mobile Money.
        paymentMethod: {
            type: DataTypes.ENUM("any", "card", "mobile_money"),
            allowNull: false,
            defaultValue: "any",
        },
        priority: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
            ...jsonColumn("metadata"),
        },
    },
    {
        sequelize,
        modelName: "ProviderRoute",
        tableName: "aggp_provider_routes",
    }
);
