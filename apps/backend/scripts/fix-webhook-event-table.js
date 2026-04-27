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

async function fixWebhookEventTable() {
    try {
        await sequelize.authenticate();
        console.log("Database connected successfully.");

        // Check current table structure
        console.log("Current aggp_webhook_events table structure:");
        const columns = await sequelize.query(
            "DESCRIBE aggp_webhook_events",
            { type: Sequelize.QueryTypes.SELECT }
        );

        columns.forEach(col => {
            console.log(`- ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
        });

        // Fix the createdAt column to have a default value
        console.log("\nFixing createdAt column...");
        await sequelize.query(
            "ALTER TABLE aggp_webhook_events MODIFY COLUMN createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            { type: Sequelize.QueryTypes.RAW }
        );

        console.log("Successfully added default value to createdAt column.");

        // Verify the fix
        console.log("\nVerifying the fix:");
        const updatedColumns = await sequelize.query(
            "DESCRIBE aggp_webhook_events",
            { type: Sequelize.QueryTypes.SELECT }
        );

        const createdAtCol = updatedColumns.find(col => col.Field === 'createdAt');
        if (createdAtCol) {
            console.log(`createdAt column: ${createdAtCol.Type} ${createdAtCol.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${createdAtCol.Default ? `DEFAULT ${createdAtCol.Default}` : ''}`);
        }

    } catch (error) {
        console.error("Error fixing WebhookEvent table:", error);
    } finally {
        await sequelize.close();
    }
}

fixWebhookEventTable();