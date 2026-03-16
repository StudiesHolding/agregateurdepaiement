import sequelize from "./config/database.js";

async function checkSchema() {
  try {
    const [results] = await sequelize.query("DESCRIBE sl_company_admins");
    console.log("Table sl_company_admins structure:");
    console.table(results);
    
    const [results2] = await sequelize.query("DESCRIBE sl_access_requests");
    console.log("\nTable sl_access_requests structure:");
    console.table(results2);

    const [results3] = await sequelize.query("DESCRIBE sl_company_packages");
    console.log("\nTable sl_company_packages structure:");
    console.table(results3);

    process.exit(0);
  } catch (error) {
    console.error("Error checking schema:", error);
    process.exit(1);
  }
}

checkSchema();
