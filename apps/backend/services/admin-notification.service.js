import { AdminNotification, sequelize } from "../models/index.js";

/**
 * Service for sending notifications to platform administrators
 */
export class AdminNotificationService {
    /**
     * Notify admins when a new B2B access request is created
     */
    static async notifyNewAccessRequest(requestId, data) {
        try {
            const { companyId, employeeId, packageId } = data;

            // Create in-app notification
            await AdminNotification.create({
                type: "access_request",
                title: "Nouvelle demande d'accès B2B",
                message: `Une nouvelle demande d'accès nécessite votre validation. ID: ${requestId}`,
                priority: "high",
                is_read: false,
                metadata: {
                    requestId,
                    companyId,
                    employeeId,
                    packageId,
                    action_url: `/requests`
                }
            });

            // Send email to admin
            const { MailService } = await import("./mail.service.js");
            const adminEmail = process.env.ADMIN_EMAIL || "admin@studiesholding.com";

            await MailService.sendAdminNotification(
                "Nouvelle demande d'accès B2B",
                `Une nouvelle demande d'accès a été soumise et nécessite votre validation.\n\n` +
                `- ID de la demande: ${requestId}\n` +
                `- Entreprise ID: ${companyId}\n` +
                `- Package ID: ${packageId}\n\n` +
                `Veuillez vous connecter au dashboard admin pour traiter cette demande.`
            );

            console.log(`[AdminNotificationService] Notification sent for request ${requestId}`);
            return true;
        } catch (error) {
            console.error("[AdminNotificationService] Error sending notification:", error.message);
            return false;
        }
    }

    /**
     * Notify admins when a request is approved
     */
    static async notifyRequestApproved(requestId, employeeEmail, companyName) {
        try {
            await AdminNotification.create({
                type: "access_approved",
                title: "Demande d'accès approuvée",
                message: `Demande ${requestId} approuvée pour ${employeeEmail} (${companyName})`,
                priority: "normal",
                is_read: false,
                metadata: {
                    requestId,
                    employeeEmail,
                    companyName,
                    action_url: `/requests`
                }
            });
            return true;
        } catch (error) {
            console.error("[AdminNotificationService] Error sending approval notification:", error.message);
            return false;
        }
    }

    /**
     * Notify admins when a request is rejected
     */
    static async notifyRequestRejected(requestId, employeeEmail, companyName, reason) {
        try {
            await AdminNotification.create({
                type: "access_rejected",
                title: "Demande d'accès rejetée",
                message: `Demande ${requestId} rejetée pour ${employeeEmail} (${companyName})`,
                priority: "normal",
                is_read: false,
                metadata: {
                    requestId,
                    employeeEmail,
                    companyName,
                    reason,
                    action_url: `/requests`
                }
            });
            return true;
        } catch (error) {
            console.error("[AdminNotificationService] Error sending rejection notification:", error.message);
            return false;
        }
    }
    /**
     * Notify admins when a commission credit fails definitively (S1-5).
     * Called after the commission step receives a definitive failure
     * (HTTP 400/401 from the SL backend). The student enrollment remains intact.
     */
    static async notifyCommissionCreditFailure(orderReference, details = {}) {
        try {
            const {
                status,
                error,
                channel,
                grossAmount,
                currency,
                formationId,
                studentId,
                correlationId,
            } = details;

            const message = `Le crédit de commission pour la commande ${orderReference} a échoué définitivement (HTTP ${status}).`;
            const emailBody = `${message}\n\n` +
                `- Erreur: ${error || "inconnue"}\n` +
                `- Canal: ${channel || "N/A"}\n` +
                `- Montant: ${grossAmount || "N/A"} ${currency || ""}\n` +
                `- Formation ID: ${formationId ?? "N/A"}\n` +
                `- Apprenant ID: ${studentId ?? "N/A"}\n` +
                `- Corrélation: ${correlationId || "N/A"}\n\n` +
                `L'inscription de l'apprenant et la commande payée restent acquises ; ` +
                `le crédit doit être rejoué après correction de la configuration.`;

            // Create in-app notification
            await AdminNotification.create({
                type: "commission_credit_failed",
                title: "Échec du crédit de commission",
                message: emailBody,
                priority: "high",
                is_read: false,
                metadata: {
                    orderReference,
                    httpStatus: status,
                    error,
                    channel,
                    grossAmount,
                    currency,
                    formationId,
                    studentId,
                    correlationId,
                    action_url: `/orders?ref=${orderReference}`,
                },
            });

            // Send email to admin
            const { MailService } = await import("./mail.service.js");
            await MailService.sendAdminNotification("Échec du crédit de commission", emailBody);

            console.log(`[AdminNotificationService] Commission credit failure notification sent for order ${orderReference}`);
            return true;
        } catch (error) {
            console.error("[AdminNotificationService] Error sending commission credit failure notification:", error.message);
            return false;
        }
    }
}

export default AdminNotificationService;
