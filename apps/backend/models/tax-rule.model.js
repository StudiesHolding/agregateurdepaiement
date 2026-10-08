import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

/** Règle de taxe d'un pays sur une période (ADR-0012, D16). Migration : database/migrations/012_tax_rules.sql. */
export class TaxRule extends Model { }

TaxRule.init(
    {
        id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        countryCode: { type: DataTypes.CHAR(2), allowNull: false },
        ratePercent: { type: DataTypes.DECIMAL(6, 3), allowNull: false, defaultValue: 0 },
        inclusive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        scope: { type: DataTypes.ENUM("all", "b2b", "b2c"), allowNull: false, defaultValue: "all" },
        label: { type: DataTypes.STRING(120), allowNull: true },
        validFrom: { type: DataTypes.DATE, allowNull: false },
        validTo: { type: DataTypes.DATE, allowNull: true },
        isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { sequelize, modelName: "TaxRule", tableName: "aggp_tax_rules" },
);
