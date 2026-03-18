import app from "./app.js";
import { sequelize } from "./models/index.js";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        console.log(" Connecting to database...");
        await sequelize.authenticate();
        console.log(" Database connection established successfully.");

        // Sync models automatically with database (safe mode - only create missing tables)
        // Don't use alter: true to avoid issues with existing tables having too many keys
        try {
            await sequelize.sync({ force: false });
            console.log(" Database models synchronized.");
        } catch (syncError) {
            console.warn(" Database sync warning:", syncError.message);
            console.log(" Continuing without model synchronization...");
        }

        // Auto-seed default admin key if missing
        try {
            const { ApiKey } = await import("./models/index.js");
            const { ApiKeyService } = await import("./services/api-key.service.js");
            const adminKeyCount = await ApiKey.count({ where: { owner: { [sequelize.Sequelize.Op.like]: 'admin:%' } } });

            if (adminKeyCount === 0) {
                const defaultKey = await ApiKeyService.generate("admin:default-key");
                console.log("\n [SECURITY] No admin key found. Generated default admin key:");
                console.log(`            KEY: ${defaultKey.key}`);
                console.log(`            OWNER: admin:default-key`);
                console.log("   --- Store this safely and delete after first production login ---\n");
            }
        } catch (seedError) {
            console.warn("  Default key seeding skipped:", seedError.message);
        }

        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log(` Server running on http://0.0.0.0:${PORT}`);
            console.log(` Health check: http://localhost:${PORT}/health`);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(` Port ${PORT} is already in use.`);
            } else {
                console.error(" Server error:", err);
            }
            process.exit(1);
        });

    } catch (error) {
        console.error(" Unable to connect to the database:", error);
        process.exit(1);
    }
};

startServer();
