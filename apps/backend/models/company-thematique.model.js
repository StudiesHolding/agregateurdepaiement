import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

/**
 * CompanyThematique
 *
 * Contexte DDD : Droit commercial détenu par une entreprise sur une offre thématique.
 * Ce n'est pas le catalogue métier (Authoring Engine). C'est un enregistrement de vente :
 * qui a acheté quoi, quand, pour quel montant.
 *
 * authoring_thematique_id référence sl_business_thematiques.id (PostgreSQL)
 * sans FK — la validité est assurée par l'Authoring Engine.
 *
 * Les licences sont gérées au niveau package (CompanyPackage) — pas de total_licenses ici.
 */
export class CompanyThematique extends Model { }

CompanyThematique.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        company_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        authoring_thematique_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'authoring_thematique_id',
            comment: 'ID métier externe référençant sl_business_thematiques.id (PostgreSQL — Authoring Engine)',
        },
        purchase_order_id: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'purchase_order_id',
            comment: 'Référence commande d\'origine (aggp_orders.reference)',
        },
        purchase_date: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        expiry_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM('active', 'expired', 'cancelled'),
            defaultValue: 'active',
        },
    },
    {
        sequelize,
        modelName: 'CompanyThematique',
        tableName: 'sl_company_thematiques',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { unique: true, fields: ['company_id', 'authoring_thematique_id'] },
            { fields: ['company_id'] },
            { fields: ['purchase_order_id'] },
        ],
    }
);

export default CompanyThematique;