
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: "EUR",
    },
    target_audience: {
      type: DataTypes.ENUM("entreprises", "particuliers", "mixed"),
      defaultValue: "entreprises",
      field: "target_audience",
    },
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      defaultValue: "draft",
    },
    formations: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "FormationPackage",
    tableName: "course_packages",
    timestamps: false,
    underscored: true,
  }
);

export default FormationPackage;
