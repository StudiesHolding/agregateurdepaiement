/**
 * CRON Job: Provider Stats Cache
 * 
 * Runs every 5 minutes to pre-aggregate provider performance statistics
 * into aggp_provider_stats_cache for instant dashboard reads.
 * 
 * Usage:
 *   node scripts/cron-stats.js
 *   (or schedule via system cron / PM2 cron)
 * 
 * Production scheduling (crontab):
 *   */5 * * * * cd / path / to / backend && node scripts / cron - stats.js >> logs / cron - stats.log 2 >& 1
    */

import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

import { sequelize, ProviderStatsCache, PaymentProvider } from "../models/index.js";
import { QueryTypes } from "sequelize";

async function computeAndCacheStats() {
    const startTime = Date.now();
    console.log(`[CronStats] Starting stats computation at ${new Date().toISOString()}`);

    try {
        await sequelize.authenticate();

        const providers = await PaymentProvider.findAll();
        const now = new Date();
        const periods = [
            { label: "1h", hours: 1 },
            { label: "24h", hours: 24 },
            { label: "7d", hours: 168 },
            { label: "30d", hours: 720 },
        ];

        let totalRecords = 0;

        for (const provider of providers) {
            for (const period of periods) {
                const periodStart = new Date(now - period.hours * 60 * 60 * 1000);

                // Get stats globally (all countries)
                const [globalStats] = await sequelize.query(
                    `SELECT
                        COUNT(pa.id) AS totalAttempts,
                        COUNT(CASE WHEN pa.status = 'succeeded' THEN 1 END) AS successCount,
                        COUNT(CASE WHEN pa.status = 'failed' THEN 1 END) AS failureCount,
                        AVG(CASE WHEN pa.status = 'succeeded' THEN pi.amount END) AS avgAmount,
                        COALESCE(SUM(CASE WHEN pa.status = 'succeeded' THEN pi.amount ELSE 0 END), 0) AS totalVolume
                    FROM aggp_payment_attempts pa
                    JOIN aggp_payment_intents pi ON pi.id = pa.payment_intent_id
                    WHERE pa.provider_id = :providerId
                      AND pa.created_at >= :periodStart`,
                    {
                        replacements: { providerId: provider.id, periodStart },
                        type: QueryTypes.SELECT,
                    }
                );

                // Get failover count (intents with > 1 attempt)
                const [failoverData] = await sequelize.query(
                    `SELECT COUNT(DISTINCT payment_intent_id) AS failoverCount
                    FROM aggp_payment_attempts
                    WHERE provider_id = :providerId
                      AND created_at >= :periodStart
                      AND payment_intent_id IN (
                          SELECT payment_intent_id
                          FROM aggp_payment_attempts
                          WHERE created_at >= :periodStart
                          GROUP BY payment_intent_id
                          HAVING COUNT(*) > 1
                      )`,
                    {
                        replacements: { providerId: provider.id, periodStart },
                        type: QueryTypes.SELECT,
                    }
                );

                // Upsert the cache record (delete old + insert new)
                await ProviderStatsCache.destroy({
                    where: {
                        providerId: provider.id,
                        countryCode: "*",
                        periodStart: periodStart,
                    },
                });

                await ProviderStatsCache.create({
                    providerId: provider.id,
                    countryCode: "*",
                    periodStart,
                    periodEnd: now,
                    totalAttempts: parseInt(globalStats.totalAttempts || 0),
                    successCount: parseInt(globalStats.successCount || 0),
                    failureCount: parseInt(globalStats.failureCount || 0),
                    failoverCount: parseInt(failoverData.failoverCount || 0),
                    avgAmount: parseFloat(globalStats.avgAmount || 0),
                    totalVolume: parseFloat(globalStats.totalVolume || 0),
                    calculatedAt: now,
                });

                totalRecords++;
            }
        }

        const duration = Date.now() - startTime;
        console.log(`[CronStats] ✅ Completed: ${totalRecords} cache records updated in ${duration}ms`);

    } catch (error) {
        console.error("[CronStats] ❌ Error:", error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

computeAndCacheStats();
