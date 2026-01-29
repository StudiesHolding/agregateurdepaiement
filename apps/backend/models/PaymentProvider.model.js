import { DataTypes, Model } from "sequelize";
import { sequelize } from "../db/sequelise.js";

export class PaymentProvider extends Model {}

PaymentProvider.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
    },
    code: {
        type: DataTypes.STRING,
    },
    name: {
        type: DataTypes.STRING,
    },
    supportCard: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    supportMobileMoney: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    }

}, {
    tableName: "aggp_payment_providers",
    sequelize
})