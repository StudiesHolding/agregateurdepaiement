import sequelize from "./config/database.js";

async function testSelect() {
  try {
    const [results] = await sequelize.query("SELECT id, email, first_name FROM sl_company_admins LIMIT 1");
    console.log("Found admin:", results);
    process.exit(0);
  } catch (error) {
    console.error("SELECT failed:", error);
    process.exit(1);
  }
}

testSelect();
