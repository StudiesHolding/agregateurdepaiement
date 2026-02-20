import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

import { sequelize, PaymentProvider, ProviderRoute } from "../models/index.js";
import { ProviderCode } from "../enums/index.js";

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("Connected to database.");

    // Sync models
    await sequelize.sync({ force: true }); // WARNING: force: true deletes existing data
    console.log("Database synced.");

    // Create Providers
    const providers = await PaymentProvider.bulkCreate([
      {
        code: ProviderCode.STRIPE,
        name: "Stripe",
        supportCard: true,
        supportMobileMoney: false,
      },
      {
        code: ProviderCode.CINETPAY,
        name: "CinetPay",
        supportCard: true,
        supportMobileMoney: true,
      },
      {
        code: ProviderCode.MAVIANCE,
        name: "Maviance",
        supportCard: false,
        supportMobileMoney: true,
      },
      {
        code: ProviderCode.KKIAPAY,
        name: "Kkiapay",
        supportCard: true,
        supportMobileMoney: true,
      },
    ]);

    console.log("Providers created.");

    // Create Routes for Cameroon (CM)
    await ProviderRoute.bulkCreate([
      {
        providerId: providers.find((p) => p.code === ProviderCode.CINETPAY).id,
        countryCode: "CM",
        currency: "XAF",
        priority: 1,
      },
      {
        providerId: providers.find((p) => p.code === ProviderCode.MAVIANCE).id,
        countryCode: "CM",
        currency: "XAF",
        priority: 2,
      },
      {
        providerId: providers.find((p) => p.code === ProviderCode.KKIAPAY).id,
        countryCode: "CM",
        currency: "XAF",
        priority: 3,
      },
    ]);

    console.log("Routes created.");
    console.log("✅ Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await sequelize.close();
  }
}

seed();
