import { ApiKeyService } from "../services/api-key.service.js";
import { sequelize } from "../models/index.js";

async function generate() {
    try {
        await sequelize.authenticate();

        // We might need to sync if the table doesn't exist
        await sequelize.sync({ alter: true });

        const owner = process.env.KEY_OWNER || "Development Team";
        const apiKey = await ApiKeyService.generate(owner);

        console.log("--------------------------------------------------");
        console.log("API Key generated successfully!");
        console.log(`Owner: ${apiKey.owner}`);
        console.log(`Key:   ${apiKey.key}`);
        console.log("--------------------------------------------------");
        console.log("Use this key in your Postman requests as: ");
        console.log("Header: X-API-KEY");
        console.log("Value:  " + apiKey.key);
        console.log("--------------------------------------------------");

    } catch (error) {
        console.error(" Failed to generate API key:", error);
    } finally {
        await sequelize.close();
    }
}

generate();
