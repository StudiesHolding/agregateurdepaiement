import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

/**
 * BusinessThematique
 *
 * Catalogue des thématiques disponibles à l'achat pour les entreprises B2B.
 * Correspond à sl_business_thematiques (MariaDB local).
 *
 * Chaque thématique regroupe un ensemble de formations sous un même domaine
 * (ex: Management, Cybersécurité, IA…).
 * Les entreprises achètent une thématique → accès à tous les packages liés.
 */
export class BusinessThematique extends Model {}

BusinessThematique.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    thematique_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    icon: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("DRAFT", "ACTIVE", "ARCHIVED"),
      allowNull: false,
      defaultValue: "DRAFT",
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: "BusinessThematique",
    tableName: "sl_business_thematiques",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default BusinessThematique;
