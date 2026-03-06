import { AdminNotification } from "../models/index.js";
import { NotFoundError } from "../utils/errors.js";

export const AdminNotificationController = {
    /**
     * Get recent notifications
     */
    async list(req, res, next) {
        try {
            const notifications = await AdminNotification.findAll({
                order: [['createdAt', 'DESC']],
                limit: 50
            });
            res.json({ success: true, data: notifications });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Mark a notification as read
     */
    async markAsRead(req, res, next) {
        try {
            const { id } = req.params;
            const notification = await AdminNotification.findByPk(id);
            if (!notification) throw new NotFoundError("Notification non trouvée");

            await notification.update({ isRead: true });
            res.json({ success: true, data: notification });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Mark all as read
     */
    async markAllAsRead(req, res, next) {
        try {
            await AdminNotification.update({ isRead: true }, { where: { isRead: false } });
            res.json({ success: true, message: "Toutes les notifications marquées comme lues" });
        } catch (error) {
            next(error);
        }
    }
};
