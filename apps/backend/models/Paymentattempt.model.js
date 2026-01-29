import { DataTypes, Model } from "sequelize";
import { PaymentIntent } from "./PaymentIntent.model.js";
import { sequelize } from "../db/sequelise.js";
export class PaymentAttempt extends Model {}

export const PaymentStatus = {
    pending: 0,
    failed: 1,
    succeeded: 2,
}

PaymentAttempt.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
    },
    transactionNumber: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.INTEGER,
        defaultValue: PaymentStatus.pending,
        allowNull: false,
    },
    responsePayload: {
        type: DataTypes.JSON
    },
    requestPayload: {
        type: DataTypes.JSON
    }
}, {
    tableName: "aggp_payment_attempts",
    sequelize: sequelize
})
PaymentAttempt.Intent = PaymentAttempt.belongsTo(PaymentIntent)