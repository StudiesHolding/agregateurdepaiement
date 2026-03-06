import { ApiKey, sequelize } from "../models/index.js";
import { ApiKeyService } from "../services/api-key.service.js";
import crypto from 'node:crypto';

/**
 * API Key Generation Tool — Studies PSP
 * Usage: node scripts/generate-key.js "admin:Name" "email@studies.com"
 * 
 * Note: Use "admin:" prefix for Dashboard access, "app:" for standard API access.
 */
async function run() {
  const owner = process.argv[2];
  const email = process.argv[3];

  if (!owner) {
    console.error(" Error: You must provide an owner name.");
    console.log("Usage for ADMIN (2FA): node scripts/generate-key.js \"admin:Name\" \"email@studies.com\"");
    console.log("Usage for APP (No 2FA):  node scripts/generate-key.js \"app:Name\"");
    process.exit(1);
  }

  const isAdmin = owner.startsWith("admin:");

  if (isAdmin && !email) {
    console.error(" Error: Admin keys require an email address for 2FA.");
    console.log("Usage: node scripts/generate-key.js \"admin:Name\" \"your@email.com\"");
    process.exit(1);
  }

  try {
    console.log(`\n Generating new API Key for: "${owner}"${email ? ` (${email})` : ""}...`);

    const apiKey = await ApiKeyService.generate(owner, email);

    console.log("\n Success!");
    console.log("--------------------------------------------------");
    console.log(`Owner: ${apiKey.owner}`);
    console.log(`Key:   ${apiKey.key}`);
    console.log("--------------------------------------------------");
    console.log("\n IMPORTANT: Keep this key secret and update your .env files.\n");

    await sequelize.close();
  } catch (error) {
    console.error(" Fatal Error:", error.message);
    process.exit(1);
  }
}

run();
