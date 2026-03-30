#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const migrateDatabase = async () => {
  try {
    console.log("🔄 Starting production migration...");
    
    // Test connection first
    await sequelize.authenticate();
    console.log("✅ Database connection established.");
    
    // Show what models will be synced
    console.log("📋 Models to sync:");
    Object.keys(sequelize.models).forEach(modelName => {
      console.log(`   - ${modelName}`);
    });
    
    // Force sync with alter: true for production (careful!)
    console.log("⚠️  WARNING: This will alter existing tables!");
    
    // Use alter: true to update existing tables
    await sequelize.sync({ alter: false, force: false });
    console.log("✅ Database models synchronized successfully!");
    
    // Verify tables exist
    const [results] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    
    console.log("📊 Tables created/updated:");
    results.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    console.log("🎉 Migration completed successfully!");
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.error("Details:", error.message);
    process.exit(1);
  }
};

// Run migration
migrateDatabase();
