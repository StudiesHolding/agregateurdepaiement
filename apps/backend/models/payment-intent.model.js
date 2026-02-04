import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";
import { PaymentStatus } from "../enums/index.js";

export class PaymentIntent extends Model {}

PaymentIntent.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PaymentStatus)),
      defaultValue: PaymentStatus.CREATED,
    },
    idempotencyKey: {
      type: DataTypes.STRING(255),
      allowNull: true,
      // Note: MySQL limit of 64 keys per table reached
      // Uniqueness is enforced at application level in PaymentIntentService
    },
    selectedProviderId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "PaymentIntent",
    tableName: "aggp_payment_intents",
  },
);
