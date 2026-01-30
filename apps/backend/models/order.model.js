import { DataTypes, Model } from "sequelize";
import { sequelize } from "../db/sequelise.js";

export class Order extends Model {}

const PaidStatus = {
    paid: "Paid",
    loading: "loading",
    notPaid: "Not Paid",

}
Order.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true
    },
    reference: {
        type: DataTypes.STRING(100),
    },
    currency: {
        type: DataTypes.STRING(10),
    },
    customer_email: {
        type: DataTypes.BIGINT.UNSIGNED,
    },
    is_paid: {
        type: DataTypes.STRING(20),
        defaultValue: PaidStatus.loading,
    },
    total_amount: {
        type: DataTypes.DECIMAL(26, 8),
    },
    formation: {
        type: DataTypes.BIGINT.UNSIGNED,
    },
    package: {
        type: DataTypes.BIGINT.UNSIGNED,
    }

}, {
    sequelize,
    tableName: "aggp_orders",
    freezeTableName: true,
})