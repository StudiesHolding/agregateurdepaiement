import { DataTypes, Model } from "sequelize";
import { PaymentProvider } from "./PaymentProvider.model.js";
//import { Order } from "./order.model.js";
import { sequelize } from "../db/sequelise.js";

export class PaymentIntent extends Model {}

const PaymentStatus = {
    pending: 0,
    failed: 1,
    succeeded: 2,
}

PaymentIntent.init({
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,

        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        currency: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        status: {
            type: DataTypes.INTEGER,
            defaultValue: PaymentStatus.pending,
            allowNull: false,
        },
        emailBuyer: {
            type: DataTypes.STRING,
        },
        idempotencyKey: {
            type: DataTypes.STRING,
        },
        formation: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        package: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        }

    },

    {
        tableName: "aggp_payment_intents",
        sequelize
    }
)

PaymentIntent.Provider = PaymentIntent.belongsTo(PaymentProvider)
    //PaymentIntent.Order = PaymentIntent.belongsTo(Order)