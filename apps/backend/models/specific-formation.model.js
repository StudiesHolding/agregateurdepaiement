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
    package_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "package_id",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "title",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "description",
    },
    duration_hours: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "duration_hours",
    },
    difficulty_level: {
      type: DataTypes.ENUM("beginner", "intermediate", "advanced"),
      defaultValue: "beginner",
      field: "difficulty_level",
    },
    objectives: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "objectives",
    },
    prerequisites: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "prerequisites",
    },
    modules: {
      type: DataTypes.LONGTEXT,
      allowNull: true,
      field: "modules",
    },
    custom_sections: {
      type: DataTypes.LONGTEXT,
      allowNull: true,
      field: "custom_sections",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updated_at",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "createdAt",
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updatedAt",
    },
  },
  {
    sequelize,
    modelName: "SpecificFormation",
    tableName: "sl_package_specific_formations",
    timestamps: true,
    underscored: true,
  },
);

export default SpecificFormation;
