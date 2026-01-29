import { DataTypes, Model } from "sequelize";
import { PaymentProvider } from "./PaymentProvider.model.js";
import { sequelize } from "../db/sequelise.js";

export class ProviderRoute extends Model {}

ProviderRoute.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
    },
    countryCode: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    minAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    maxAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,

    }
}, {
    tableName: "aggp_payment_routes",
    sequelize
})

ProviderRoute.Provider = ProviderRoute.belongsTo(PaymentProvider)