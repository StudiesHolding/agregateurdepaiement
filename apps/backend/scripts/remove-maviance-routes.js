import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

const sequelize = new Sequelize(
    process.env.DATABASE_NAME,
    process.env.DATABASE_USER,
    process.env.DATABASE_PASSWORD,
    {
        host: process.env.DATABASE_HOST,
        port: process.env.DATABASE_PORT || 3306,
        dialect: "mysql",
        logging: false,
    }
);

async function removeMavianceRoutes() {
    try {
        await sequelize.authenticate();
        console.log("Database connected successfully.");

        // Find Maviance provider
        const [mavianceProvider] = await sequelize.query(
            "SELECT id FROM aggp_payment_providers WHERE code = 'maviance'",
            { type: Sequelize.QueryTypes.SELECT }
        );

        if (!mavianceProvider) {
            console.log("Maviance provider not found in database. Nothing to remove.");
            return;
        }

        console.log(`Found Maviance provider with ID: ${mavianceProvider.id}`);

        // Check existing routes before deletion
        const existingRoutes = await sequelize.query(
            "SELECT COUNT(*) as count FROM aggp_provider_routes WHERE provider_id = ?",
            {
                replacements: [mavianceProvider.id],
                type: Sequelize.QueryTypes.SELECT
            }
        );

        console.log(`Found ${existingRoutes[0].count} Maviance routes before deletion.`);

        // Delete routes for Maviance provider
        await sequelize.query(
            "DELETE FROM aggp_provider_routes WHERE provider_id = ?",
            {
                replacements: [mavianceProvider.id],
                type: Sequelize.QueryTypes.DELETE
            }
        );

        // Check routes after deletion
        const remainingRoutes = await sequelize.query(
            "SELECT COUNT(*) as count FROM aggp_provider_routes WHERE provider_id = ?",
            {
                replacements: [mavianceProvider.id],
                type: Sequelize.QueryTypes.SELECT
            }
        );

        console.log(`Remaining Maviance routes: ${remainingRoutes[0].count}`);
        console.log(`Successfully cleaned up Maviance routes from database.`);

    } catch (error) {
        console.error("Error removing Maviance routes:", error);
    } finally {
        await sequelize.close();
    }
}

removeMavianceRoutes();