import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";
import { OrderStatus } from "../enums/index.js";

export class Order extends Model { }

Order.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        reference: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
        },
        customerEmail: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        customerName: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        currency: {
            type: DataTypes.STRING(10),
            allowNull: false,
        },
        totalAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM(...Object.values(OrderStatus)),
            defaultValue: OrderStatus.PENDING,
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        lmsItemId: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: "ID of the Course, Package, or Subscription in the LMS",
        },
        lmsItemType: {
            type: DataTypes.ENUM("course", "package", "subscription"),
            allowNull: true,
            comment: "Type of item being purchased",
        },
    },
    {
        sequelize,
        modelName: "Order",
        tableName: "aggp_orders",
    }
);
