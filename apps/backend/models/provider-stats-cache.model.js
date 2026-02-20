import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

/**
 * Provider Stats Cache — pre-aggregated performance stats per provider/country/period.
 * Populated by a background CRON job every 5 minutes.
 * Allows instant dashboard reads without heavy real-time SQL aggregations.
 */
export class ProviderStatsCache extends Model { }

ProviderStatsCache.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        providerId: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        // '*' means aggregated across all countries
        countryCode: {
            type: DataTypes.STRING(10),
            defaultValue: "*",
        },
        periodStart: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        periodEnd: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        // Aggregated counters
        totalAttempts: {
            type: DataTypes.INTEGER.UNSIGNED,
            defaultValue: 0,
        },
        successCount: {
            type: DataTypes.INTEGER.UNSIGNED,
            defaultValue: 0,
        },
        failureCount: {
            type: DataTypes.INTEGER.UNSIGNED,
            defaultValue: 0,
        },
        // A failover is when attempts > 1 for a given payment intent
        failoverCount: {
            type: DataTypes.INTEGER.UNSIGNED,
            defaultValue: 0,
        },
        avgAmount: {
            type: DataTypes.DECIMAL(15, 2),
            allowNull: true,
        },
        totalVolume: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
        },
        calculatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: "ProviderStatsCache",
        tableName: "aggp_provider_stats_cache",
        timestamps: false,
        indexes: [
            { fields: ["provider_id", "period_start"] },
            { fields: ["country_code", "period_start"] },
        ],
    }
);
