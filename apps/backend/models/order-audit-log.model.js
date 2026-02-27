import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

/**
 * OrderAuditLog - Traçabilité complète du cycle de vie des commandes
 * 
 * Enregistre TOUTES les actions effectuées sur une commande:
 * - Création, paiement, validation, finalisation
 * - Qui a fait l'action (admin, system, webhook)
 * - État avant/après (pour rollback)
 * - IP, UserAgent, emails envoyés
 */
export class OrderAuditLog extends Model { }

OrderAuditLog.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        
        // === Order Reference ===
        orderId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            field: 'order_id',
            comment: 'ID de la commande',
        },
        orderReference: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'order_reference',
            comment: 'Référence dénormalisée pour requêtes rapides',
        },
        
        // === Action ===
        action: {
            type: DataTypes.STRING(50),
            allowNull: false,
            comment: 'Type action: ORDER_CREATED, ORDER_VALIDATED, etc.',
        },
        actionLabel: {
            type: DataTypes.STRING(255),
            allowNull: false,
            field: 'action_label',
            comment: 'Label affiché dans UI ex: "Commande validée"',
        },
        
        // === Actor (qui a fait l'action) ===
        actorType: {
            type: DataTypes.ENUM('system', 'admin', 'webhook', 'api'),
            defaultValue: 'system',
            field: 'actor_type',
            comment: 'Type d\'acteur: system=automatique, admin=utilisateur admin',
        },
        actorId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true,
            field: 'actor_id',
            comment: 'ID de l\'admin si actorType=admin',
        },
        actorEmail: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'actor_email',
            comment: 'Email ou identifiant de l\'acteur',
        },
        
        // === State Changes (JSON) ===
        previousState: {
            type: DataTypes.JSON,
            allowNull: true,
            field: 'previous_state',
            comment: 'État avant l\'action (pour rollback)',
        },
        newState: {
            type: DataTypes.JSON,
            allowNull: true,
            field: 'new_state',
            comment: 'État après l\'action',
        },
        
        // === Connection Context ===
        ipAddress: {
            type: DataTypes.STRING(45),
            allowNull: true,
            field: 'ip_address',
            comment: 'Adresse IP IPv4 ou IPv6',
        },
        userAgent: {
            type: DataTypes.STRING(500),
            allowNull: true,
            field: 'user_agent',
            comment: 'Navigateur/client',
        },
        
        // === Email Tracking ===
        emailSentTo: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'email_sent_to',
            comment: 'Destinataire si email envoyé',
        },
        emailSentAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'email_sent_at',
            comment: 'Date d\'envoi de l\'email',
        },
        
        // === Timestamp ===
        createdAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
    },
    {
        sequelize,
        modelName: 'OrderAuditLog',
        tableName: 'aggp_order_audit_logs',
        timestamps: false, // We only use createdAt manually
        updatedAt: false, // Immutable records
        indexes: [
            { fields: ['order_id'] },
            { fields: ['order_reference'] },
            { fields: ['action'] },
            { fields: ['actor_id'] },
            { fields: ['created_at'] },
        ],
    }
);

/**
 * Action Types - Constants for type safety
 */
export const OrderAuditAction = {
    // Phase paiement
    ORDER_CREATED: 'ORDER_CREATED',
    PAYMENT_INITIATED: 'PAYMENT_INITIATED',
    PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
    PAYMENT_FAILED: 'PAYMENT_FAILED',
    PAYMENT_CONFIRMED_VIEWED: 'PAYMENT_CONFIRMED_VIEWED',
    
    // Phase validation
    ORDER_VALIDATED: 'ORDER_VALIDATED',
    ORDER_REJECTED: 'ORDER_REJECTED',
    
    // Phase finalisation
    ORDER_COMPLETED: 'ORDER_COMPLETED',
    CREDENTIALS_SENT: 'CREDENTIALS_SENT',
    FACTURE_SENT: 'FACTURE_SENT',
    
    // Phase expiration
    ORDER_EXPIRED: 'ORDER_EXPIRED',
    ORDER_CANCELLED: 'ORDER_CANCELLED',
};

/**
 * Action Labels - Human readable labels for UI
 */
export const OrderAuditActionLabels = {
    [OrderAuditAction.ORDER_CREATED]: 'Commande créée',
    [OrderAuditAction.PAYMENT_INITIATED]: 'Paiement initié',
    [OrderAuditAction.PAYMENT_RECEIVED]: 'Paiement reçu',
    [OrderAuditAction.PAYMENT_FAILED]: 'Paiement échoué',
    [OrderAuditAction.PAYMENT_CONFIRMED_VIEWED]: 'Commande consultée par l\'admin',
    [OrderAuditAction.ORDER_VALIDATED]: 'Commande validée',
    [OrderAuditAction.ORDER_REJECTED]: 'Commande rejetée',
    [OrderAuditAction.ORDER_COMPLETED]: 'Commande finalisée',
    [OrderAuditAction.CREDENTIALS_SENT]: 'Identifiants envoyés',
    [OrderAuditAction.FACTURE_SENT]: 'Facture envoyée',
    [OrderAuditAction.ORDER_EXPIRED]: 'Commande expirée',
    [OrderAuditAction.ORDER_CANCELLED]: 'Commande annulée',
};

export default OrderAuditLog;
