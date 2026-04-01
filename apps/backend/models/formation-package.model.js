import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

export class FormationPackage extends Model {}

FormationPackage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: false,
      primaryKey: true,
      allowNull: false,
      field: "id",
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "name",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "description",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "price",
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "image_url",
    },
    featured: {
      type: DataTypes.TINYINT(1),
      allowNull: true,
      defaultValue: 0,
      field: "featured",
    },
    target_audience: {
      type: DataTypes.ENUM("entreprises", "particuliers", "mixed"),
      allowNull: false,
      defaultValue: "entreprises",
      field: "target_audience",
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      field: "updated_at",
    },
    max_licenses: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "max_licenses",
    },
    benefits: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "benefits",
    },
    custom_sections: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "custom_sections",
    },
    total_duration: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "total_duration",
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      defaultValue: "EUR",
      field: "currency",
    },
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      allowNull: true,
      defaultValue: "draft",
      field: "status",
    },
    formations: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "formations",
    },
  },
  {
    sequelize,
    modelName: "FormationPackage",
    tableName: "course_packages",
    timestamps: false,
    underscored: true,
  },
);

export default FormationPackage;
