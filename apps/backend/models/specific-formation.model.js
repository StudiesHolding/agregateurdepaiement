import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

export class SpecificFormation extends Model {}

SpecificFormation.init(
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    durationHours: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "duration_hours",
    },
    difficultyLevel: {
      type: DataTypes.ENUM("beginner", "intermediate", "advanced"),
      defaultValue: "beginner",
      field: "difficulty_level",
    },
    objectives: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    prerequisites: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    modules: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    customSections: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "custom_sections",
    },
  },
  {
    sequelize,
    modelName: "SpecificFormation",
    tableName: "sl_package_specific_formations",
    timestamps: true,
    underscored: true,
  }
);

export default SpecificFormation;
