import { CompanyAdmin, Company } from "./models/index.js";

async function testSequelizeFind() {
  try {
    const admin = await CompanyAdmin.findOne({ 
      where: { email: "studies@tech.com" },
      include: [{ model: Company, as: "company" }]
    });
    console.log("Found admin with Sequelize:", admin ? admin.toJSON() : "Not found");
    process.exit(0);
  } catch (error) {
    console.error("Sequelize find failed:", error);
    process.exit(1);
  }
}

testSequelizeFind();
