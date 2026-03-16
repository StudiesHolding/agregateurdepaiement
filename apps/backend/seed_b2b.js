import { Company, CompanyAdmin } from "./models/index.js";
import bcrypt from "bcrypt";

async function seedB2B() {
  try {
    // 1. Create a default company
    const [company] = await Company.findOrCreate({
      where: { email: "contact@studies.tech" },
      defaults: {
        name: "Studies Tech",
        address: "123 Tech Avenue",
        domain: "studies.tech",
        is_active: true
      }
    });
    console.log("✅ Company created/found:", company.name);

    // 2. Create the studies@tech.com admin
    const password = "password123"; // You should probably change this or ask the user
    const existingAdmin = await CompanyAdmin.findOne({ where: { email: "studies@tech.com" } });
    
    if (!existingAdmin) {
      await CompanyAdmin.create({
        company_id: company.id,
        email: "studies@tech.com",
        password_hash: password, // The hook in the model will hash it
        first_name: "Studies",
        last_name: "Admin",
        role: "admin",
        is_active: true
      });
      console.log("✅ Admin studies@tech.com created.");
    } else {
      console.log("ℹ️ Admin studies@tech.com already exists.");
      // Ensure it has the correct first_name/last_name if missing
      await existingAdmin.update({
        first_name: "Studies",
        last_name: "Admin"
      });
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedB2B();
