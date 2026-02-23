import { NotificationSettings } from "../models/index.js";
import sequelize from "../config/database.js";
import { QueryTypes } from "sequelize";

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
     * Search for potential admins in the LMS database (kyd4_users)
     */
    async searchLmsUsers(req, res, next) {
        try {
            const { q } = req.query;
            let queryStr = `
                SELECT u.ID as id, u.user_email as email, u.display_name as name
                FROM kyd4_users u
                JOIN kyd4_usermeta um ON u.ID = um.user_id
                WHERE um.meta_key = 'kyd4_capabilities' AND um.meta_value LIKE '%"administrator"%'
            `;
            let replacements = {};

            if (q) {
                queryStr += ` AND (u.user_email LIKE :query OR u.display_name LIKE :query) LIMIT 20`;
                replacements.query = `%${q}%`;
            } else {
                queryStr += ` LIMIT 50`;
            }

            const users = await sequelize.query(queryStr, {
                replacements,
                type: QueryTypes.SELECT
            });

            res.json({ success: true, data: users });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Create or Update notification preferences for a specific email
     */
    async updateSetting(req, res, next) {
        try {
            const { adminEmail, notifyOnSuccess, notifyOnFailure, notifyOnSuspicious, isActive } = req.body;

            if (!adminEmail) {
                return res.status(400).json({ success: false, error: "adminEmail is required" });
            }

            let [setting, created] = await NotificationSettings.findOrCreate({
                where: { adminEmail },
                defaults: { notifyOnSuccess, notifyOnFailure, notifyOnSuspicious, isActive }
            });

            if (!created) {
                await setting.update({ notifyOnSuccess, notifyOnFailure, notifyOnSuspicious, isActive });
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
