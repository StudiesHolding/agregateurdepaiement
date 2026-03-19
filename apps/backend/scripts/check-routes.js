/**
 * Script to check current provider routes in database
 */

import dotenv from "dotenv";
dotenv.config();

import { PaymentProvider, ProviderRoute, sequelize } from "../models/index.js";

const checkRoutes = async () => {
    try {
        await sequelize.authenticate();
        console.log("✅ Database connection established.\n");

        // Get all providers
        const providers = await PaymentProvider.findAll({
            where: { isActive: true }
        });

        console.log("📦 ACTIVE PROVIDERS:");
        providers.forEach(p => {
            console.log(`   - ${p.name} [${p.code}] | Card: ${p.supportCard ? '✅' : '❌'} | Mobile: ${p.supportMobileMoney ? '✅' : '❌'}`);
        });
        console.log("");

        // Get all routes
        const routes = await ProviderRoute.findAll({
            include: [{ model: PaymentProvider, as: "provider" }],
            order: [["priority", "ASC"], ["countryCode", "ASC"]]
        });

        console.log("🌍 CURRENT ROUTING RULES:");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("Priority | Country | Currency | Provider");
        console.log("═══════════════════════════════════════════════════════════════");

        routes.forEach(r => {
            console.log(`   ${r.priority.toString().padEnd(8)} | ${r.countryCode.padEnd(7)} | ${r.currency.padEnd(4)} | ${r.provider?.name || 'N/A'}`);
        });

        console.log("═══════════════════════════════════════════════════════════════\n");

        // Analysis by payment method
        console.log("📊 ANALYSIS BY SCENARIO:");
        console.log("");

        const scenarios = [
            { country: "CM", currency: "XAF", method: "card", desc: "Cameroon + XAF + Card" },
            { country: "CM", currency: "XAF", method: "mobile_money", desc: "Cameroon + XAF + Mobile Money" },
            { country: "CM", currency: "EUR", method: "card", desc: "Cameroon + EUR + Card" },
            { country: "CI", currency: "XOF", method: "mobile_money", desc: "Ivory Coast + XOF + Mobile Money" },
            { country: "FR", currency: "EUR", method: "card", desc: "France + EUR + Card" },
            { country: "US", currency: "USD", method: "card", desc: "USA + USD + Card" },
        ];

        scenarios.forEach(scenario => {
            const matchingRoutes = routes.filter(r =>
                (r.countryCode === scenario.country || r.countryCode === "*") &&
                (r.currency === scenario.currency)
            );

            console.log(`🎯 ${scenario.desc}:`);
            if (matchingRoutes.length === 0) {
                console.log("   ❌ NO ROUTES FOUND - Will fail!");
            } else {
                matchingRoutes.forEach(r => {
                    const provider = r.provider;
                    const supportsMethod = scenario.method === "card"
                        ? provider?.supportCard
                        : provider?.supportMobileMoney;
                    console.log(`   → ${provider?.name} [${supportsMethod ? '✅' : '❌'}]`);
                });
            }
            console.log("");
        });

        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
};

checkRoutes();
