import { PaymentProvider, ProviderRoute, sequelize } from "../models/index.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Script to seed initial payment providers and routing rules
 */
const seedProviders = async () => {
    try {
        await sequelize.authenticate();
        console.log("✅ Database connection established.");

        // Synchronize models (ensure tables exist)
        await sequelize.sync({ alter: true });
        console.log("✅ Database synced.");

        // --- CLEANUP STEP ---
        console.log("🧹 Cleaning up existing data...");

        // Disable foreign key checks to allow truncation of parent tables
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

        // Clear all relevant tables
        await ProviderRoute.destroy({ where: {}, truncate: true });
        await PaymentProvider.destroy({ where: {}, truncate: true });

        // Re-enable foreign key checks
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log("   - Existing providers and routes cleared safely.");

        // 1. Define Providers (WITHOUT credentialsEncrypted for security)
        // Credentials will be loaded from .env at runtime by the adapters
        const providers = [
            {
                code: "STRIPE",
                name: "Stripe",
                isActive: true,
                supportCard: true,
                supportMobileMoney: false,
                credentialsEncrypted: null // Keep it null, managed by .env
            },
            {
                code: "CINETPAY",
                name: "CinetPay",
                isActive: true,
                supportCard: true,
                supportMobileMoney: true,
                credentialsEncrypted: null // Keep it null, managed by .env
            }
        ];

        console.log("🚀 Seeding Payment Providers...");
        const createdProviders = {};

        for (const p of providers) {
            const provider = await PaymentProvider.create(p);
            createdProviders[p.code] = provider;
            console.log(`   - Provider ${p.name} [${p.code}] created.`);
        }

        // 2. Define Routing Rules
        const routes = [
            // CinetPay for West/Central Africa (XOF/XAF)
            {
                providerId: createdProviders["CINETPAY"].id,
                countryCode: "CI", // Côte d'Ivoire
                currency: "XOF",
                priority: 1
            },
            {
                providerId: createdProviders["CINETPAY"].id,
                countryCode: "SN", // Sénégal
                currency: "XOF",
                priority: 1
            },
            {
                providerId: createdProviders["CINETPAY"].id,
                countryCode: "CM", // Cameroun
                currency: "XAF",
                priority: 1
            },
            {
                providerId: createdProviders["CINETPAY"].id,
                countryCode: "GN", // Guinée
                currency: "GNF",
                priority: 1
            },
            // Stripe as Global Default (Wildcard)
            {
                providerId: createdProviders["STRIPE"].id,
                countryCode: "*", // All countries
                currency: "EUR",
                priority: 10 // Low priority, used as fallback
            },
            {
                providerId: createdProviders["STRIPE"].id,
                countryCode: "*",
                currency: "USD",
                priority: 10
            }
        ];

        console.log("🌍 Seeding Routing Rules...");
        for (const r of routes) {
            await ProviderRoute.create(r);
            console.log(`   - Route for ${r.countryCode} / ${r.currency} added.`);
        }

        console.log("\n✨ Database initialization completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
};

seedProviders();
