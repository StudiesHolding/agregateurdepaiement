import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";
import {
    PaymentIntent,
    PaymentAttempt,
    Order,
    PaymentProvider,
    WebhookEvent,
} from "../models/index.js";
import { PaymentStatus, AttemptStatus } from "../enums/index.js";
import { Op, fn, col, literal } from "sequelize";

/**
 * Analytics Service
 * Provides pre-aggregated statistics for the Payment Operations Dashboard.
 * Reads directly from the aggp_* tables using optimized queries.
 */
export class AnalyticsService {
    /**
     * Global KPIs for the Command Center
     * Returns today's key metrics with 24h comparison
     */
    static async getOverviewKpis() {
        const now = new Date();
        const start24h = new Date(now - 24 * 60 * 60 * 1000);
        const start48h = new Date(now - 48 * 60 * 60 * 1000);

        // Revenue and transaction count for last 24h
        const [current24h] = await sequelize.query(
            `SELECT
                COUNT(DISTINCT pi.id) AS transactionCount,
                COALESCE(SUM(CASE WHEN pi.status = 'succeeded' THEN pi.amount ELSE 0 END), 0) AS revenueSucceeded,
                COALESCE(SUM(pi.amount), 0) AS revenueTotal,
                COUNT(CASE WHEN pi.status = 'succeeded' THEN 1 END) AS successCount,
                COUNT(CASE WHEN pi.status = 'failed' THEN 1 END) AS failureCount
            FROM aggp_payment_intents pi
            WHERE pi.created_at >= :start`,
            { replacements: { start: start24h }, type: QueryTypes.SELECT }
        );

        // Previous 24h for trend calculation
        const [prev24h] = await sequelize.query(
            `SELECT
                COALESCE(SUM(CASE WHEN pi.status = 'succeeded' THEN pi.amount ELSE 0 END), 0) AS revenueSucceeded,
                COUNT(DISTINCT pi.id) AS transactionCount
            FROM aggp_payment_intents pi
            WHERE pi.created_at >= :start AND pi.created_at < :end`,
            { replacements: { start: start48h, end: start24h }, type: QueryTypes.SELECT }
        );

        // Failover Rate: intents that needed more than 1 attempt
        const [failoverData] = await sequelize.query(
            `SELECT
                COUNT(DISTINCT pa.payment_intent_id) AS failoverCount
            FROM aggp_payment_attempts pa
            INNER JOIN (
                SELECT payment_intent_id
                FROM aggp_payment_attempts
                WHERE created_at >= :start
                GROUP BY payment_intent_id
                HAVING COUNT(*) > 1
            ) multi ON multi.payment_intent_id = pa.payment_intent_id`,
            { replacements: { start: start24h }, type: QueryTypes.SELECT }
        );

        const successRate = current24h.transactionCount > 0
            ? ((current24h.successCount / current24h.transactionCount) * 100).toFixed(1)
            : 0;

        const failoverRate = current24h.transactionCount > 0
            ? ((failoverData.failoverCount / current24h.transactionCount) * 100).toFixed(1)
            : 0;

        const revenueTrend = prev24h.revenueSucceeded > 0
            ? (((current24h.revenueSucceeded - prev24h.revenueSucceeded) / prev24h.revenueSucceeded) * 100).toFixed(1)
            : 0;

        const transactionTrend = prev24h.transactionCount > 0
            ? (((current24h.transactionCount - prev24h.transactionCount) / prev24h.transactionCount) * 100).toFixed(1)
            : 0;

        return {
            revenue24h: parseFloat(current24h.revenueSucceeded),
            transactionCount24h: parseInt(current24h.transactionCount),
            successRate: parseFloat(successRate),
            failoverRate: parseFloat(failoverRate),
            failoverCount: parseInt(failoverData.failoverCount),
            trends: {
                revenue: parseFloat(revenueTrend),
                transactions: parseFloat(transactionTrend),
            },
        };
    }

    /**
     * Time-series data for the Revenue Chart
     * @param {string} period - '24h' | '7d' | '30d' | '90d'
     */
    static async getTimeSeries(period = "30d") {
        const periodMap = {
            "24h": { interval: 1, unit: "HOUR", format: "%Y-%m-%d %H:00" },
            "7d": { interval: 7, unit: "DAY", format: "%Y-%m-%d" },
            "30d": { interval: 30, unit: "DAY", format: "%Y-%m-%d" },
            "90d": { interval: 90, unit: "DAY", format: "%Y-%m-%d" },
        };

        const { interval, unit, format } = periodMap[period] || periodMap["30d"];

        const rows = await sequelize.query(
            `SELECT
                DATE_FORMAT(pi.created_at, :format) AS period,
                COUNT(*) AS totalCount,
                COUNT(CASE WHEN pi.status = 'succeeded' THEN 1 END) AS successCount,
                COALESCE(SUM(CASE WHEN pi.status = 'succeeded' THEN pi.amount ELSE 0 END), 0) AS revenue
            FROM aggp_payment_intents pi
            WHERE pi.created_at >= DATE_SUB(NOW(), INTERVAL :interval ${unit})
            GROUP BY DATE_FORMAT(pi.created_at, :format)
            ORDER BY period ASC`,
            { replacements: { format, interval }, type: QueryTypes.SELECT }
        );

        return rows.map(r => ({
            period: r.period,
            totalCount: parseInt(r.totalCount),
            successCount: parseInt(r.successCount),
            revenue: parseFloat(r.revenue),
            successRate: r.totalCount > 0 ? ((r.successCount / r.totalCount) * 100).toFixed(1) : 0,
        }));
    }

    /**
     * Provider performance analytics
     * Returns success/failure rates per provider for the given period
     * @param {string} period - '1h' | '24h' | '7d' | '30d'
     */
    static async getProviderPerformance(period = "24h") {
        const periodMap = { "1h": 1, "24h": 24, "7d": 168, "30d": 720 };
        const hours = periodMap[period] || 24;

        const rows = await sequelize.query(
            `SELECT
                pp.id AS providerId,
                pp.name,
                pp.code,
                pp.is_active AS isActive,
                pp.support_card AS supportCard,
                pp.support_mobile_money AS supportMobileMoney,
                COUNT(pa.id) AS totalAttempts,
                COUNT(CASE WHEN pa.status = 'succeeded' THEN 1 END) AS successCount,
                COUNT(CASE WHEN pa.status = 'failed' THEN 1 END) AS failureCount,
                ROUND(
                    CASE WHEN COUNT(pa.id) > 0 
                         THEN (COUNT(CASE WHEN pa.status = 'succeeded' THEN 1 END) / COUNT(pa.id)) * 100 
                         ELSE 0 END, 
                1) AS successRate,
                COALESCE(COUNT(CASE WHEN pa.status = 'succeeded' THEN pa.id END), 0) AS succeededAttempts
            FROM aggp_payment_providers pp
            LEFT JOIN aggp_payment_attempts pa 
                ON pa.provider_id = pp.id 
                AND pa.created_at >= DATE_SUB(NOW(), INTERVAL :hours HOUR)
            GROUP BY pp.id, pp.name, pp.code, pp.is_active, pp.support_card, pp.support_mobile_money
            ORDER BY totalAttempts DESC`,
            { replacements: { hours }, type: QueryTypes.SELECT }
        );

        return rows.map(provider => {
            // Compute health status
            let healthStatus = "inactive";
            if (provider.isActive) {
                if (provider.totalAttempts === 0) healthStatus = "idle";
                else if (provider.successRate >= 80) healthStatus = "operational";
                else if (provider.successRate >= 50) healthStatus = "degraded";
                else healthStatus = "critical";
            }
            return { ...provider, healthStatus };
        });
    }

    /**
     * Top errors per provider
     */
    static async getProviderTopErrors(providerId, period = "24h") {
        const periodMap = { "1h": 1, "24h": 24, "7d": 168, "30d": 720 };
        const hours = periodMap[period] || 24;

        return await sequelize.query(
            `SELECT
                error_code AS errorCode,
                error_message AS errorMessage,
                COUNT(*) AS occurrences
            FROM aggp_payment_attempts
            WHERE provider_id = :providerId
              AND status = 'failed'
              AND error_code IS NOT NULL
              AND created_at >= DATE_SUB(NOW(), INTERVAL :hours HOUR)
            GROUP BY error_code, error_message
            ORDER BY occurrences DESC
            LIMIT 10`,
            { replacements: { providerId, hours }, type: QueryTypes.SELECT }
        );
    }

    /**
     * Geographic breakdown: volume and success rate by country
     */
    static async getGeoBreakdown(period = "30d") {
        const periodMap = { "7d": 7, "30d": 30, "90d": 90 };
        const days = periodMap[period] || 30;

        return await sequelize.query(
            `SELECT
                pr.country_code AS countryCode,
                COUNT(pa.id) AS totalAttempts,
                COUNT(CASE WHEN pa.status = 'succeeded' THEN 1 END) AS successCount,
                COALESCE(SUM(CASE WHEN pa.status = 'succeeded' THEN pi.amount ELSE 0 END), 0) AS volume,
                ROUND(
                    CASE WHEN COUNT(pa.id) > 0 
                         THEN (COUNT(CASE WHEN pa.status = 'succeeded' THEN 1 END) / COUNT(pa.id)) * 100 
                         ELSE 0 END, 
                1) AS successRate
            FROM aggp_payment_attempts pa
            JOIN aggp_payment_intents pi ON pi.id = pa.payment_intent_id
            JOIN aggp_payment_providers pp ON pp.id = pa.provider_id
            JOIN aggp_provider_routes pr ON pr.provider_id = pp.id
            WHERE pa.created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
            GROUP BY pr.country_code
            ORDER BY volume DESC`,
            { replacements: { days }, type: QueryTypes.SELECT }
        );
    }

    /**
     * Webhook monitoring stats
     */
    static async getWebhookStats() {
        const [stats] = await sequelize.query(
            `SELECT
                COUNT(*) AS total24h,
                COUNT(CASE WHEN processed = 1 THEN 1 END) AS processedCount,
                COUNT(CASE WHEN signature_valid = 0 THEN 1 END) AS invalidSignatureCount,
                COUNT(CASE WHEN processed = 0 THEN 1 END) AS pendingCount,
                AVG(CASE WHEN processed = 1 AND processed_at IS NOT NULL 
                    THEN TIMESTAMPDIFF(SECOND, created_at, processed_at) END) AS avgProcessingSeconds
            FROM aggp_webhook_events
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
            { type: QueryTypes.SELECT }
        );

        return {
            total24h: parseInt(stats.total24h || 0),
            processedCount: parseInt(stats.processedCount || 0),
            processingRate: stats.total24h > 0
                ? ((stats.processedCount / stats.total24h) * 100).toFixed(1)
                : 0,
            invalidSignatureCount: parseInt(stats.invalidSignatureCount || 0),
            pendingCount: parseInt(stats.pendingCount || 0),
            avgProcessingSeconds: parseFloat(stats.avgProcessingSeconds || 0).toFixed(1),
        };
    }

    /**
     * Provider health sparkline (48h success rate, hourly)
     */
    static async getProviderSparkline(providerId) {
        return await sequelize.query(
            `SELECT
                DATE_FORMAT(created_at, '%Y-%m-%d %H:00') AS hour,
                COUNT(*) AS total,
                COUNT(CASE WHEN status = 'succeeded' THEN 1 END) AS successes,
                ROUND(
                    CASE WHEN COUNT(*) > 0 
                         THEN (COUNT(CASE WHEN status = 'succeeded' THEN 1 END) / COUNT(*)) * 100 
                         ELSE 0 END, 
                1) AS successRate
            FROM aggp_payment_attempts
            WHERE provider_id = :providerId
              AND created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d %H:00')
            ORDER BY hour ASC`,
            { replacements: { providerId }, type: QueryTypes.SELECT }
        );
    }
}
