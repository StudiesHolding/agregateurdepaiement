import { OrderAuditLog, OrderAuditAction, OrderAuditActionLabels } from "../models/order-audit-log.model.js";

/**
 * OrderAuditService - Service de traçabilité pour le cycle de vie des commandes
 * 
 * Enregistre TOUTES les actions effectuées sur les commandes avec:
 * - Identification complète de l'acteur (admin, system, webhook)
 * - État avant/après pour chaque action
 * - IP et UserAgent pour traçabilité
 * - Tracking des emails envoyés
 */
export class OrderAuditService {
    
    /**
     * Créer une entrée d'audit
     */
    static async log(params) {
        const {
            orderId,
            orderReference,
            action,
            actionLabel = null,
            actorType = 'system',
            actorId = null,
            actorEmail = null,
            previousState = null,
            newState = null,
            ipAddress = null,
            userAgent = null,
            emailSentTo = null,
        } = params;
        
        try {
            const auditEntry = await OrderAuditLog.create({
                orderId,
                orderReference,
                action,
                actionLabel: actionLabel || OrderAuditActionLabels[action] || action,
                actorType,
                actorId,
                actorEmail,
                previousState,
                newState,
                ipAddress,
                userAgent,
                emailSentTo,
                emailSentAt: emailSentTo ? new Date() : null,
                createdAt: new Date(),
            });
            
            console.log(`[OrderAudit] ${action} - Order ${orderReference} - Actor: ${actorType}`);
            return auditEntry;
            
        } catch (error) {
            // Ne jamais faire échouer l'opération principale si l'audit échoue
            console.error('[OrderAudit] Failed to log audit entry:', error.message);
            return null;
        }
    }
    
    /**
     * Logger une action système automatique
     */
    static async logSystemAction(params) {
        return this.log({
            ...params,
            actorType: 'system',
            actorId: null,
            actorEmail: 'system',
        });
    }
    
    /**
     * Logger une action admin
     */
    static async logAdminAction(params) {
        return this.log({
            ...params,
            actorType: 'admin',
        });
    }
    
    /**
     * Logger une action webhook
     */
    static async logWebhookAction(params) {
        return this.log({
            ...params,
            actorType: 'webhook',
        });
    }
    
    /**
     * Logger une action API
     */
    static async logApiAction(params) {
        return this.log({
            ...params,
            actorType: 'api',
        });
    }
    
    /**
     * Logger quand un email est envoyé
     */
    static async logEmailSent(params) {
        return this.log({
            ...params,
            action: params.action || OrderAuditAction.FACTURE_SENT,
            emailSentTo: params.emailSentTo,
        });
    }
    
    /**
     * Récupérer l'historique d'une commande
     */
    static async getOrderHistory(orderId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        
        return OrderAuditLog.findAll({
            where: { orderId },
            order: [['createdAt', 'ASC']],
            limit,
            offset,
        });
    }
    
    /**
     * Récupérer l'historique par référence
     */
    static async getOrderHistoryByReference(orderReference, options = {}) {
        const { limit = 50, offset = 0 } = options;
        
        return OrderAuditLog.findAll({
            where: { orderReference },
            order: [['createdAt', 'ASC']],
            limit,
            offset,
        });
    }
    
    /**
     * Récupérer les dernières actions d'un admin
     */
    static async getAdminActions(actorEmail, options = {}) {
        const { limit = 50, offset = 0 } = options;
        
        return OrderAuditLog.findAll({
            where: {
                actorType: 'admin',
                actorEmail,
            },
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });
    }
    
    /**
     * Compter les actions par type
     */
    static async getActionCounts(orderId) {
        const logs = await OrderAuditLog.findAll({
            where: { orderId },
            attributes: [
                'action',
                [OrderAuditLog.sequelize.fn('COUNT', OrderAuditLog.sequelize.col('action')), 'count']
            ],
            group: ['action'],
        });
        
        return logs.reduce((acc, log) => {
            acc[log.action] = parseInt(log.dataValues.count);
            return acc;
        }, {});
    }
}

export default OrderAuditService;
