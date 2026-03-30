#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const diagnoseDatabase = async () => {
  try {
    console.log("🔍 Diagnosing database state...");
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Database connection established.");
    
    // Check existing tables
    const [existingTables] = await sequelize.query(`
      SELECT table_name, table_comment 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      ORDER BY table_name
    `);
    
    console.log("📋 Existing tables:");
    if (existingTables.length === 0) {
      console.log("   No tables found - database is empty");
    } else {
      existingTables.forEach(table => {
        console.log(`   ✓ ${table.table_name}`);
      });
    }
    
    // Check for specific tables that should exist
    const requiredTables = [
      'sl_companies',
      'sl_formation_packages', 
      'sl_company_packages'
    ];
    
    console.log("\n🔍 Checking required tables:");
    for (const tableName of requiredTables) {
      const exists = existingTables.some(t => t.table_name === tableName);
      if (exists) {
        console.log(`   ✅ ${tableName} exists`);
        
        // Check table structure
        const [columns] = await sequelize.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = DATABASE() AND table_name = '${tableName}'
          ORDER BY ordinal_position
        `);
        
        console.log(`      Columns: ${columns.map(c => c.column_name).join(', ')}`);
        
        // Check indexes
        const [indexes] = await sequelize.query(`
          SHOW INDEX FROM ${tableName}
        `);
        
        if (indexes.length > 0) {
          console.log(`      Indexes: ${indexes.map(i => i.Key_name).join(', ')}`);
        }
        
      } else {
        console.log(`   ❌ ${tableName} MISSING`);
      }
    }
    
    // Check if we can create the missing tables
    console.log("\n🔧 Testing table creation...");
    
    // Test creating sl_companies if missing
    if (!existingTables.some(t => t.table_name === 'sl_companies')) {
      try {
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS sl_companies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            metadata JSON,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB
        `);
        console.log("   ✅ Created sl_companies table");
      } catch (error) {
        console.error("   ❌ Failed to create sl_companies:", error.message);
      }
    }
    
    // Test creating sl_formation_packages if missing
    if (!existingTables.some(t => t.table_name === 'sl_formation_packages')) {
      try {
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS sl_formation_packages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL DEFAULT 0,
            currency VARCHAR(3) DEFAULT 'XAF',
            metadata JSON,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB
        `);
        console.log("   ✅ Created sl_formation_packages table");
      } catch (error) {
        console.error("   ❌ Failed to create sl_formation_packages:", error.message);
      }
    }
    
    // Test creating sl_company_packages if missing
    if (!existingTables.some(t => t.table_name === 'sl_company_packages')) {
      try {
        // First try without foreign keys
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS sl_company_packages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            package_id INT NOT NULL,
            total_licenses INT NOT NULL DEFAULT 0,
            used_licenses INT NOT NULL DEFAULT 0,
            purchase_date DATETIME NOT NULL,
            expiry_date DATETIME NULL,
            status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB
        `);
        console.log("   ✅ Created sl_company_packages table (without foreign keys)");
        
        // Now add foreign keys
        try {
          await sequelize.query(`
            ALTER TABLE sl_company_packages 
            ADD CONSTRAINT fk_company_packages_company 
            FOREIGN KEY (company_id) REFERENCES sl_companies(id) 
            ON DELETE CASCADE ON UPDATE CASCADE
          `);
          console.log("   ✅ Added foreign key: company_id -> sl_companies.id");
        } catch (fkError) {
          console.warn("   ⚠️  Could not add company_id foreign key:", fkError.message);
        }
        
        try {
          await sequelize.query(`
            ALTER TABLE sl_company_packages 
            ADD CONSTRAINT fk_company_packages_package 
            FOREIGN KEY (package_id) REFERENCES sl_formation_packages(id) 
            ON DELETE CASCADE ON UPDATE CASCADE
          `);
          console.log("   ✅ Added foreign key: package_id -> sl_formation_packages.id");
        } catch (fkError) {
          console.warn("   ⚠️  Could not add package_id foreign key:", fkError.message);
        }
        
      } catch (error) {
        console.error("   ❌ Failed to create sl_company_packages:", error.message);
      }
    }
    
    console.log("\n🎉 Database diagnosis completed!");
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Diagnosis failed:", error);
    console.error("Details:", error.message);
    process.exit(1);
  }
};

// Run diagnosis
diagnoseDatabase();
