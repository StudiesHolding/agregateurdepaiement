import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

export class ApiKey extends Model { }

ApiKey.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        key: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
        },
        owner: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        lastUsedAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: true, // Optional for app keys, required for admin keys
        },
    },
    {
        sequelize,
        modelName: "ApiKey",
        tableName: "aggp_api_keys",
        underscored: true,
    }
);
