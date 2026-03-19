/**
 * Script to seed production-ready payment routing rules
 * 
 * RULES:
 * - Card payments: Always use Stripe (any country)
 * - Mobile Money: Use local aggregators per country
 * - Unknown countries: Use Stripe as fallback
 */

import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

import { PaymentProvider, ProviderRoute, sequelize } from "../models/index.js";

const seedProductionRoutes = async () => {
    try {
        await sequelize.authenticate();
        console.log("✅ Database connection established.");

        // Get providers
        const providers = await PaymentProvider.findAll({
            where: { isActive: true }
        });

        const getProviderId = (code) => {
            const p = providers.find(p => p.code.toLowerCase() === code.toLowerCase());
            if (!p) throw new Error(`Provider ${code} not found`);
            return p.id;
        };

        console.log("📦 Available providers:", providers.map(p => p.code).join(", "));

        // Define routing rules
        // Priority: Lower = Higher priority (0 = highest)
        const routes = [
            // ==========================================
            // MOBILE MONEY - Local aggregators by country
            // ==========================================

            // Cameroon (CM) - XAF
            { providerId: getProviderId('cinetpay'), countryCode: 'CM', currency: 'XAF', priority: 10, minAmount: 100, maxAmount: 5000000 },
            { providerId: getProviderId('kkiapay'), countryCode: 'CM', currency: 'XAF', priority: 20, minAmount: 100, maxAmount: 5000000 },
            { providerId: getProviderId('maviance'), countryCode: 'CM', currency: 'XAF', priority: 30, minAmount: 100, maxAmount: 5000000 },

            // Ivory Coast (CI) - XOF
            { providerId: getProviderId('cinetpay'), countryCode: 'CI', currency: 'XOF', priority: 10, minAmount: 100, maxAmount: 5000000 },

            // Senegal (SN) - XOF
            { providerId: getProviderId('cinetpay'), countryCode: 'SN', currency: 'XOF', priority: 10, minAmount: 100, maxAmount: 5000000 },

            // Benin (BJ) - XOF
            { providerId: getProviderId('kkiapay'), countryCode: 'BJ', currency: 'XOF', priority: 10, minAmount: 100, maxAmount: 5000000 },
            { providerId: getProviderId('cinetpay'), countryCode: 'BJ', currency: 'XOF', priority: 20, minAmount: 100, maxAmount: 5000000 },

            // Togo (TG) - XOF
            { providerId: getProviderId('cinetpay'), countryCode: 'TG', currency: 'XOF', priority: 10, minAmount: 100, maxAmount: 5000000 },

            // Burkina Faso (BF) - XOF
            { providerId: getProviderId('cinetpay'), countryCode: 'BF', currency: 'XOF', priority: 10, minAmount: 100, maxAmount: 5000000 },

            // Mali (ML) - XOF
            { providerId: getProviderId('cinetpay'), countryCode: 'ML', currency: 'XOF', priority: 10, minAmount: 100, maxAmount: 5000000 },

            // Niger (NE) - XOF
            { providerId: getProviderId('cinetpay'), countryCode: 'NE', currency: 'XOF', priority: 10, minAmount: 100, maxAmount: 5000000 },

            // Guinea (GN) - GNF
            { providerId: getProviderId('cinetpay'), countryCode: 'GN', currency: 'GNF', priority: 10, minAmount: 1000, maxAmount: 50000000 },

            // ==========================================
            // CARD PAYMENTS - Stripe for ALL countries
            // ==========================================

            // Global wildcard for Stripe - EUR (for card payments only)
            { providerId: getProviderId('stripe'), countryCode: '*', currency: 'EUR', priority: 100, minAmount: 1, maxAmount: null },

            // Global wildcard for Stripe - USD
            { providerId: getProviderId('stripe'), countryCode: '*', currency: 'USD', priority: 100, minAmount: 1, maxAmount: null },

            // Global wildcard for Stripe - XAF (card payments from Africa to international cards)
            { providerId: getProviderId('stripe'), countryCode: '*', currency: 'XAF', priority: 100, minAmount: 1, maxAmount: null },

            // Global wildcard for Stripe - XOF
            { providerId: getProviderId('stripe'), countryCode: '*', currency: 'XOF', priority: 100, minAmount: 1, maxAmount: null },

            // Global wildcard for Stripe - GBP
            { providerId: getProviderId('stripe'), countryCode: '*', currency: 'GBP', priority: 100, minAmount: 1, maxAmount: null },

            // Global wildcard for Stripe - CHF
            { providerId: getProviderId('stripe'), countryCode: '*', currency: 'CHF', priority: 100, minAmount: 1, maxAmount: null },

            // Global wildcard for Stripe - CAD
            { providerId: getProviderId('stripe'), countryCode: '*', currency: 'CAD', priority: 100, minAmount: 1, maxAmount: null },
        ];

        console.log("\n🧹 Clearing existing routes...");
        await ProviderRoute.destroy({ where: {}, truncate: true });
        console.log("   - Routes cleared.");

        console.log("\n🌍 Seeding new routing rules...");
        for (const r of routes) {
            await ProviderRoute.create(r);
            console.log(`   ✅ ${r.countryCode.padEnd(3)} | ${r.currency.padEnd(4)} | Priority ${r.priority} | ${providers.find(p => p.id === r.providerId)?.name || 'N/A'}`);
        }

        console.log("\n✨ Production routing rules seeded successfully!");
        console.log("\n📋 Summary:");
        console.log("   - Mobile Money: Local aggregators (CinetPay, KKiaPay, Maviance)");
        console.log("   - Card: Stripe (global fallback)");
        console.log("   - Priority: Mobile Money (10-30) < Card (100)");

        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
};

seedProductionRoutes();
