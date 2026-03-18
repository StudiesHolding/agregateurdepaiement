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
}

export default AdminNotificationService;
