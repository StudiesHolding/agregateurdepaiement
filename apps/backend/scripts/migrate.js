import {
    sequelize,
    AdminNotification,
    NotificationSettings,
    AdminAuditLog,
    OrderAuditLog,
    VerifiedEmail
} from "../models/index.js";

async function migrate() {
    console.log("🚀 Starting targeted migration...");
    try {
        await sequelize.authenticate();
        console.log("✅ Database connection established.");

        // We only sync specific models that were recently added or changed
        // This avoids triggering 'alter: true' on large tables like aggp_orders
        console.log("⏳ Synchronizing targeted models...");

        await AdminNotification.sync({ alter: true });
        console.log("✅ AdminNotification table synchronized.");

        await NotificationSettings.sync({ alter: true });
        console.log("✅ NotificationSettings table synchronized.");

        // Also ensure audit logs exist as they are new/recent
        await AdminAuditLog.sync({ alter: true });
        console.log("✅ AdminAuditLog table synchronized.");

        await OrderAuditLog.sync({ alter: true });
        console.log("✅ OrderAuditLog table synchronized.");

        console.log("\n✨ Migration completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Migration failed:");
        console.error(error);
        process.exit(1);
    }
}

migrate();
