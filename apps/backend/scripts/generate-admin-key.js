import { ApiKeyService } from "../services/api-key.service.js";
import { sequelize } from "../models/index.js";

async function run() {
    const owner = process.argv[2];
    if (!owner) {
        console.error("Usage: node generate-admin-key.js admin:NAME");
        process.exit(1);
    }

    try {
        await sequelize.authenticate();
        const key = await ApiKeyService.generate(owner);
        console.log("\n🚀 Admin API Key Generated successfully!");
        console.log("-----------------------------------------");
        console.log(`OWNER: ${owner}`);
        console.log(`KEY:   ${key.key}`);
        console.log("-----------------------------------------");
        console.log("Utilisez cette clé dans le dashboard pour vous connecter.\n");
        process.exit(0);
    } catch (err) {
        console.error("Error generating key:", err.message);
        process.exit(1);
    }
}

run();
