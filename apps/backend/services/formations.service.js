import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";

/**
 * Formations Service
 * Fetches formations from WordPress/LearnPress database (kyd4_posts)
 */
export class FormationsService {
    /**
     * Get all available formations from WordPress
     */
    static async getFormations() {
        try {
            const rows = await sequelize.query(
                `SELECT 
                    p.ID as id,
                    p.post_title as title,
                    p.post_date as createdAt,
                    pm1.meta_value as price,
                    pm2.meta_value as thumbnail
                FROM kyd4_posts p
                LEFT JOIN kyd4_postmeta pm1 ON p.ID = pm1.post_id AND pm1.meta_key = '_lp_price'
                LEFT JOIN kyd4_postmeta pm2 ON p.ID = pm2.post_id AND pm2.meta_key = '_lp_thumbnail'
                WHERE p.post_type = 'lp_course'
                  AND p.post_status = 'publish'
                ORDER BY p.post_date DESC`,
                { type: QueryTypes.SELECT }
            );

            return rows.map(r => ({
                id: String(r.id),
                title: r.title,
                price: r.price ? parseFloat(r.price) : 0,
                thumbnail: r.thumbnail || null,
                createdAt: r.createdAt,
            }));
        } catch (err) {
            console.error("[FormationsService] getFormations error:", err.message);
            return [];
        }
    }

    /**
     * Get a single formation by ID
     */
    static async getFormation(id) {
        try {
            const [row] = await sequelize.query(
                `SELECT 
                    p.ID as id,
                    p.post_title as title,
                    p.post_content as description,
                    p.post_date as createdAt,
                    pm1.meta_value as price,
                    pm2.meta_value as thumbnail,
                    pm3.meta_value as instructor,
                    pm4.meta_value as duration
                FROM kyd4_posts p
                LEFT JOIN kyd4_postmeta pm1 ON p.ID = pm1.post_id AND pm1.meta_key = '_lp_price'
                LEFT JOIN kyd4_postmeta pm2 ON p.ID = pm2.post_id AND pm2.meta_key = '_lp_thumbnail'
                LEFT JOIN kyd4_postmeta pm3 ON p.ID = pm3.post_id AND pm3.meta_key = '_lp_instructor'
                LEFT JOIN kyd4_postmeta pm4 ON p.ID = pm4.post_id AND pm4.meta_key = '_lp_duration'
                WHERE p.post_type = 'lp_course'
                  AND p.post_status = 'publish'
                  AND p.ID = :id`,
                { 
                    replacements: { id },
                    type: QueryTypes.SELECT 
                }
            );

            if (!row) return null;

            return {
                id: String(row.id),
                title: row.title,
                description: row.description || '',
                price: row.price ? parseFloat(row.price) : 0,
                thumbnail: row.thumbnail || null,
                instructor: row.instructor || null,
                duration: row.duration || null,
                createdAt: row.createdAt,
            };
        } catch (err) {
            console.error("[FormationsService] getFormation error:", err.message);
            return null;
        }
    }

    /**
     * Get a single package by ID
     */
    static async getPackage(id) {
        try {
            const rows = await sequelize.query(
                `SELECT 
                    id,
                    name as title,
                    description,
                    price,
                    currency,
                    image_url as thumbnail,
                    created_at as createdAt
                FROM course_packages
                WHERE id = :id AND featured = 1`,
                { 
                    replacements: { id },
                    type: QueryTypes.SELECT 
                }
            );

            if (!rows || rows.length === 0) return null;
            const row = rows[0];

            return {
                id: String(row.id),
                title: row.title,
                description: row.description || '',
                price: row.price ? parseFloat(row.price) : 0,
                thumbnail: row.thumbnail || null,
                currency: row.currency || 'XOF',
                createdAt: row.createdAt,
                isPackage: true
            };
        } catch (err) {
            console.error("[FormationsService] getPackage error:", err.message);
            return null;
        }
    }
}
