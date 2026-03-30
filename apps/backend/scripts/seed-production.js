#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import { ApiKey } from "../models/index.js";
import { ApiKeyService } from "../services/api-key.service.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const seedProductionData = async () => {
  try {
    console.log("🌱 Starting production seeding...");
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Database connection established.");
    
    // Seed admin API key
    console.log("🔑 Checking admin API key...");
    const adminKeyCount = await ApiKey.count({ 
      where: { 
        owner: { [sequelize.Sequelize.Op.like]: 'admin:%' } 
      } 
    });

    if (adminKeyCount === 0) {
      console.log("📝 No admin key found. Creating default admin key...");
      const defaultKey = await ApiKeyService.generate("admin:default-key");
      console.log("\n🔐 ADMIN API KEY GENERATED:");
      console.log("================================");
      console.log(`KEY: ${defaultKey.key}`);
      console.log(`OWNER: admin:default-key`);
      console.log("================================");
      console.log("⚠️  STORE THIS SAFELY - DELETE AFTER FIRST LOGIN!\n");
    } else {
      console.log(`✅ Found ${adminKeyCount} admin key(s) in database.`);
    }
    
    // Seed other default data here if needed
    // Example: default providers, packages, etc.
    
    console.log("🎉 Production seeding completed successfully!");
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    console.error("Details:", error.message);
    process.exit(1);
  }
};

// Run seeding
seedProductionData();
