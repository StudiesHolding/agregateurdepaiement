import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";

/**
 * LMS Bridge Service
 * Provides a safe, read-only bridge to the LMS MySQL tables (kyd4_* and sl_*).
 * The dashboard never accesses the LMS DB directly — all goes through this service.
 * 
 * NOTE: This service assumes the PSP backend shares the same MySQL database
 * as the Studies Learning LMS platform. Connection is via the existing Sequelize instance.
 */
export class LmsBridgeService {
    /**
     * Get top-selling formations with revenue from PSP orders
     * Joins aggp_orders.metadata.courseId with kyd4_posts
     * @param {number} limit
     * @param {string} period - '7d' | '30d' | '90d'
     */
    static async getTopFormations(limit = 10, period = "30d") {
        const periodMap = { "7d": 7, "30d": 30, "90d": 90 };
        const days = periodMap[period] || 30;

        try {
            // We extract courseId from the JSON metadata stored in aggp_orders
            const rows = await sequelize.query(
                `SELECT
                    JSON_UNQUOTE(JSON_EXTRACT(o.metadata, '$.courseId')) AS courseId,
                    JSON_UNQUOTE(JSON_EXTRACT(o.metadata, '$.courseName')) AS courseName,
                    JSON_UNQUOTE(JSON_EXTRACT(o.metadata, '$.packageType')) AS packageType,
                    COUNT(o.id) AS salesCount,
                    COALESCE(SUM(o.total_amount), 0) AS totalRevenue,
                    AVG(o.total_amount) AS avgAmount,
                    o.currency
                FROM aggp_orders o
                WHERE o.status = 'completed'
                  AND o.created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
                  AND JSON_EXTRACT(o.metadata, '$.courseId') IS NOT NULL
                GROUP BY courseId, courseName, packageType, o.currency
                ORDER BY totalRevenue DESC
                LIMIT :limit`,
                { replacements: { days, limit }, type: QueryTypes.SELECT }
            );

            return rows.map(r => ({
                courseId: r.courseId,
                courseName: r.courseName || `Formation #${r.courseId}`,
                packageType: r.packageType,
                salesCount: parseInt(r.salesCount),
                totalRevenue: parseFloat(r.totalRevenue),
                avgAmount: parseFloat(r.avgAmount),
                currency: r.currency,
            }));
        } catch (err) {
            console.warn("[LmsBridge] getTopFormations failed:", err.message);
            return [];
        }
    }

    /**
     * Get formateurs wallet summary from LMS tables
     * Reads sl_wallets + sl_wallet_transactions + kyd4_users
     */
    static async getWalletSummary() {
        try {
            const [summary] = await sequelize.query(
                `SELECT
                    COUNT(w.id) AS activeWallets,
                    COALESCE(SUM(w.balance), 0) AS totalBalance,
                    COALESCE(SUM(w.total_earned), 0) AS totalEarned
                FROM sl_wallets w
                WHERE w.status = 'active'`,
                { type: QueryTypes.SELECT }
            );

            const [monthlyRevenue] = await sequelize.query(
                `SELECT
                    COALESCE(SUM(amount), 0) AS monthlyCredit
                FROM sl_wallet_transactions
                WHERE type = 'credit'
                  AND status = 'completed'
                  AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
                { type: QueryTypes.SELECT }
            );

            const topFormateurs = await sequelize.query(
                `SELECT
                    u.display_name AS name,
                    u.user_email AS email,
                    w.balance,
                    w.total_earned AS totalEarned,
                    COUNT(DISTINCT p.ID) AS formationCount
                FROM sl_wallets w
                JOIN kyd4_users u ON w.user_id = u.ID
                LEFT JOIN kyd4_posts p 
                    ON p.post_author = u.ID 
                    AND p.post_type = 'formation'
                    AND p.post_status = 'publish'
                WHERE w.status = 'active'
                GROUP BY w.id, u.display_name, u.user_email, w.balance, w.total_earned
                ORDER BY w.total_earned DESC
                LIMIT 5`,
                { type: QueryTypes.SELECT }
            );

            return {
                activeWallets: parseInt(summary.activeWallets || 0),
                totalBalance: parseFloat(summary.totalBalance || 0),
                totalEarned: parseFloat(summary.totalEarned || 0),
                monthlyCredit: parseFloat(monthlyRevenue.monthlyCredit || 0),
                topFormateurs: topFormateurs.map(f => ({
                    name: f.name,
                    email: f.email,
                    balance: parseFloat(f.balance),
                    totalEarned: parseFloat(f.totalEarned),
                    formationCount: parseInt(f.formationCount),
                })),
            };
        } catch (err) {
            // LMS tables may not be accessible in all environments (e.g., separate DB)
            console.warn("[LmsBridge] getWalletSummary failed (LMS tables may not be accessible):", err.message);
            return null;
        }
    }

    /**
     * Get total published formations count
     */
    static async getFormationsStats() {
        try {
            const [stats] = await sequelize.query(
                `SELECT
                    COUNT(*) AS totalPublished,
                    COUNT(CASE WHEN post_date >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 END) AS newThisMonth
                FROM kyd4_posts
                WHERE post_type = 'formation'
                  AND post_status = 'publish'`,
                { type: QueryTypes.SELECT }
            );

            return {
                totalPublished: parseInt(stats.totalPublished || 0),
                newThisMonth: parseInt(stats.newThisMonth || 0),
            };
        } catch (err) {
            console.warn("[LmsBridge] getFormationsStats failed:", err.message);
            return null;
        }
    }

    /**
     * Synchronize enrollment status in the LMS
     * Triggered after a successful payment
     * @param {Order} order 
     */
    static async syncEnrollment(order) {
        if (!order.lmsItemId || !order.customerEmail) {
            console.log(`[LmsBridge] Skipping enrollment sync: No LMS item ID or customer email for Order ${order.reference}`);
            return;
        }

        try {
            // 1. Find the User in LMS
            const [user] = await sequelize.query(
                `SELECT ID FROM kyd4_users WHERE user_email = :email LIMIT 1`,
                { replacements: { email: order.customerEmail }, type: QueryTypes.SELECT }
            );

            if (!user) {
                console.warn(`[LmsBridge] Enrollment FAILED: User with email ${order.customerEmail} not found in LMS database.`);
                return;
            }

            // 2. Check if already enrolled to avoid duplicates
            const [existing] = await sequelize.query(
                `SELECT user_item_id FROM kyd4_learnpress_user_items 
                 WHERE user_id = :userId AND item_id = :itemId AND item_type = 'lp_course' LIMIT 1`,
                {
                    replacements: { userId: user.ID, itemId: order.lmsItemId },
                    type: QueryTypes.SELECT
                }
            );

            if (existing) {
                console.log(`[LmsBridge] User ${user.ID} already enrolled in Course ${order.lmsItemId}. Updating status.`);
                await sequelize.query(
                    `UPDATE kyd4_learnpress_user_items SET status = 'enrolled' WHERE user_item_id = :id`,
                    { replacements: { id: existing.user_item_id }, type: QueryTypes.UPDATE }
                );
            } else {
                // 3. Perform Enrollment
                console.log(`[LmsBridge] Enrolling User ${user.ID} into Course ${order.lmsItemId}...`);
                await sequelize.query(
                    `INSERT INTO kyd4_learnpress_user_items 
                     (user_id, item_id, start_time, item_type, status, access_level)
                     VALUES (:userId, :itemId, NOW(), 'lp_course', 'enrolled', 50)`,
                    {
                        replacements: { userId: user.ID, itemId: order.lmsItemId },
                        type: QueryTypes.INSERT
                    }
                );
            }

            console.log(`[LmsBridge] Successfully synchronized enrollment for Order ${order.reference}`);
        } catch (err) {
            console.error(`[LmsBridge] CRITICAL Error during enrollment sync for Order ${order.reference}:`, err.message);
        }
    }
}
