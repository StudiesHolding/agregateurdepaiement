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

        // 1. Define Providers
        const providers = [
            {
                code: "STRIPE",
                name: "Stripe",
                isActive: true,
                supportCard: true,
                supportMobileMoney: false,
                credentialsEncrypted: {
                    secretKey: process.env.STRIPE_SECRET_KEY,
                    publishableKey: process.env.STRIPE_Publishable_Key
                }
            },
            {
                code: "CINETPAY",
                name: "CinetPay",
                isActive: true,
                supportCard: true,
                supportMobileMoney: true,
                credentialsEncrypted: {
                    apiKey: process.env.CINETPAY_API_KEY,
                    siteId: process.env.CINETPAY_SITE_ID
                }
            }
        ];

        console.log("🚀 Seeding Payment Providers...");
        const createdProviders = {};

        for (const p of providers) {
            const [provider] = await PaymentProvider.upsert(p);
            createdProviders[p.code] = provider;
            console.log(`   - Provider ${p.name} [${p.code}] synchronized.`);
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

        console.log(" Seeding Routing Rules...");
        for (const r of routes) {
            await ProviderRoute.upsert(r);
            console.log(`   - Route for ${r.countryCode} / ${r.currency} added.`);
        }

        console.log("\n Seeding completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error(" Seeding failed:", error);
        process.exit(1);
    }
};

seedProviders();
