import sequelize from "./config/database.js";

async function fixDatabase() {
  try {
    console.log("🛠️ Starting database fix...");

    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");

    // 1. Fix sl_formation_packages invalid JSON data
    console.log("  - Fixing sl_formation_packages invalid JSON...");
    await sequelize.query("UPDATE sl_formation_packages SET formations = '[]' WHERE formations = '' OR formations IS NULL");
    
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");

    console.log("✅ Database fix completed. Now run the server to sync.");
    process.exit(0);
  } catch (error) {
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
    console.error("❌ Fix failed:", error);
    process.exit(1);
  }
}

fixDatabase();
