import { ApiKeyService } from "../services/api-key.service.js";
import { sequelize } from "../models/index.js";

/**
 * API Key Generation Tool
 * Usage: node scripts/generate-key.js "Owner Name"
 */
async function run() {
  const owner = process.argv[2];

  if (!owner) {
    console.error(" Error: You must provide an owner name.");
    console.log("Usage: node scripts/generate-key.js \"admin:Your Name\"");
    process.exit(1);
  }

  try {
    console.log(`\n Generating new API Key for: "${owner}"...`);

    const apiKey = await ApiKeyService.generate(owner);

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
