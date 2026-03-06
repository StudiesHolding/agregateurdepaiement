import { NotificationSettings, ApiKey } from "../models/index.js";
import sequelize from "../config/database.js";
import { QueryTypes, Op } from "sequelize";

export const NotificationController = {
    /**
     * Get all configured notification settings and cross-reference with LMS users
     */
    async getSettings(req, res, next) {
        try {
            const settings = await NotificationSettings.findAll();
            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get current authenticated admin's settings
     */
    async getMe(req, res, next) {
        try {
            const adminEmail = req.adminEmail;
            if (!adminEmail) {
                return res.status(200).json({ success: true, data: null });
            }

            const setting = await NotificationSettings.findOne({
                where: { adminEmail }
            });

            res.json({
                success: true,
                data: setting
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Search for potential admins in the Dashboard API Keys table
     */
    async searchAdmins(req, res, next) {
        try {
            const { q } = req.query;

            const where = {
                owner: { [Op.like]: 'admin:%' }
            };

            if (q) {
                where[Op.or] = [
                    { owner: { [Op.like]: `%${q}%` } },
                    { email: { [Op.like]: `%${q}%` } }
                ];
            }

            const keys = await ApiKey.findAll({
                where,
                attributes: ['id', 'email', 'owner'],
                limit: 50
            });

            // Map to uniform format: id, email, name
            const admins = keys.map(k => ({
                id: k.id,
                email: k.email || (k.owner.includes(':') ? k.owner.split(':')[1] : k.owner),
                name: k.owner.includes(':') ? k.owner.split(':')[1] : k.owner
            }));

            res.json({ success: true, data: admins });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create or Update notification preferences for a specific email
     */
    async updateSetting(req, res, next) {
        try {
            const {
                notifyOnSuccess,
                notifyOnFailure,
                notifyOnSuspicious,
                notifyOnNewOrder,
                notifyWithSound,
                isActive
            } = req.body;

            // Use email from body or from authenticated session
            const adminEmail = req.body.adminEmail || req.adminEmail;

            if (!adminEmail) {
                return res.status(400).json({ success: false, error: "adminEmail is required (or must be authenticated)" });
            }

            let [setting, created] = await NotificationSettings.findOrCreate({
                where: { adminEmail },
                defaults: {
                    notifyOnSuccess,
                    notifyOnFailure,
                    notifyOnSuspicious,
                    notifyOnNewOrder,
                    notifyWithSound,
                    isActive
                }
            });

            if (!created) {
                await setting.update({
                    notifyOnSuccess,
                    notifyOnFailure,
                    notifyOnSuspicious,
                    notifyOnNewOrder,
                    notifyWithSound,
                    isActive
                });
            }

            res.json({ success: true, data: setting });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Delete a notification setting
     */
    async deleteSetting(req, res, next) {
        try {
            const { id } = req.params;
            const setting = await NotificationSettings.findByPk(id);
            if (!setting) {
                return res.status(404).json({ success: false, error: "Setting not found" });
            }
            await setting.destroy();
            res.json({ success: true, message: "Setting deleted successfully" });
        } catch (error) {
            next(error);
        }
    }
};
