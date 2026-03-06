import { ApiKey, sequelize } from "../models/index.js";
import crypto from 'node:crypto';

/**
 * API Key Generation Tool
 * Usage: node scripts/generate-key.js "Owner Name"
 */
async function run() {
  const owner = process.argv[2];
  const email = process.argv[3];

  if (!owner || !email) {
    console.error(" Error: You must provide an owner name AND an email address.");
    console.log("Usage: node scripts/generate-key.js \"admin:Your Name\" \"your@email.com\"");
    process.exit(1);
  }

  try {
    console.log(`\n Generating new API Key for: "${owner}" (${email})...`);

    const apiKey = await ApiKey.create({
      key: `sk_${crypto.randomBytes(24).toString('hex')}`,
      owner,
      email,
      isActive: true
    });

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
