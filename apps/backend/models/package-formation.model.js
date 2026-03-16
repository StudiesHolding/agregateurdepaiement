import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

export class PackageFormation extends Model {}

PackageFormation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    packageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "package_id",
    },
    formationType: {
      type: DataTypes.ENUM("global", "package_specific"),
      defaultValue: "global",
      field: "formation_type",
    },
    globalFormationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "global_formation_id",
    },
    packageFormationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "package_formation_id",
    },
    formationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "formation_id", // Generic field used sometimes
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: "PackageFormation",
    tableName: "sl_package_formations",
    timestamps: false,
    underscored: true,
  }
);

export default PackageFormation;
