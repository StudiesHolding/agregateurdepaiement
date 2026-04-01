import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

export class FormationPackage extends Model {}

FormationPackage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "description",
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: "price",
    },
    image_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "image_url",
    },
    target_audience: {
      type: DataTypes.ENUM("entreprises", "particuliers", "mixed"),
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "title",
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
      field: "currency",
    },
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      allowNull: true,
      field: "status",
    },
    formations: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "formations",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: "is_active",
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
