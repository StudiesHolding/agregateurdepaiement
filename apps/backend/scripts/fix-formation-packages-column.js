#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const fixFormationPackagesColumn = async () => {
  try {
    console.log("🔧 Fixing formations column in sl_formation_packages...");
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Database connection established.");
    
    // Check current structure
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'sl_formation_packages'
      ORDER BY ordinal_position
    `);
    
    console.log("📋 Current columns:");
    columns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Check if formations column exists
    const hasFormationsColumn = columns.some(col => col.column_name === 'formations');
    console.log(`\n🔍 Has 'formations' column: ${hasFormationsColumn}`);
    
    if (!hasFormationsColumn) {
      console.log("🔧 Adding missing 'formations' column...");
      
      try {
        await sequelize.query(`
          ALTER TABLE sl_formation_packages 
          ADD COLUMN formations JSON NULL
        `);
        console.log("   ✅ Added formations column (JSON type)");
      } catch (error) {
        console.error("   ❌ Failed to add formations column:", error.message);
        
        // Try alternative approach
        console.log("🔧 Trying alternative approach...");
        try {
          await sequelize.query(`
            ALTER TABLE sl_formation_packages 
            ADD COLUMN formations TEXT NULL
          `);
          console.log("   ✅ Added formations column (TEXT type)");
        } catch (altError) {
          console.error("   ❌ Alternative approach failed:", altError.message);
          throw altError;
        }
      }
    } else {
      console.log("   ✅ formations column already exists");
    }
    
    // Test the query that was failing
    console.log("\n🧪 Testing FormationPackage.findAll()...");
    
    try {
      const FormationPackage = (await import("../models/formation-package.model.js")).default;
      const packages = await FormationPackage.findAll({
        order: [['price', 'ASC']],
      });
      
      console.log(`   ✅ Successfully found ${packages.length} packages`);
      
      if (packages.length > 0) {
        console.log("📋 Sample package data:");
        const sample = packages[0];
        Object.keys(sample.dataValues).forEach(key => {
          const value = sample.dataValues[key];
          const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
          console.log(`   ${key}: ${displayValue}`);
        });
      }
      
    } catch (testError) {
      console.error("   ❌ Test query failed:", testError.message);
      console.error("   SQL:", testError.sql);
      
      // Try to identify the exact issue
      if (testError.message.includes("Unknown column")) {
        console.log("🔍 Column mismatch detected between model and database");
        
        // Show model vs database comparison
        console.log("\n📋 Model expects these columns:");
        const FormationPackage = (await import("../models/formation-package.model.js")).default;
        Object.keys(FormationPackage.rawAttributes).forEach(attr => {
          console.log(`   ${attr}: ${FormationPackage.rawAttributes[attr].type.key || FormationPackage.rawAttributes[attr].type}`);
        });
      }
    }
    
    // Verify final structure
    console.log("\n🔍 Verifying final structure...");
    const [finalColumns] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'sl_formation_packages'
      ORDER BY ordinal_position
    `);
    
    console.log("📋 Final sl_formation_packages structure:");
    finalColumns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });
    
    console.log("\n🎉 Formation packages column fix completed!");
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Fix failed:", error);
    console.error("Details:", error.message);
    process.exit(1);
  }
};

// Run fix
fixFormationPackagesColumn();
