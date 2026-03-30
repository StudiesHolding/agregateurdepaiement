#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const fixFormationPackages = async () => {
  try {
    console.log("🔧 Fixing sl_formation_packages table structure...");
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Database connection established.");
    
    // Check current structure of sl_formation_packages
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default, extra
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'sl_formation_packages'
      ORDER BY ordinal_position
    `);
    
    console.log("📋 Current sl_formation_packages structure:");
    columns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.extra || ''}`);
    });
    
    // Check if id column exists and is primary key
    const idColumn = columns.find(col => col.column_name === 'id');
    const hasIdColumn = idColumn !== undefined;
    const isIdPrimary = idColumn?.extra?.includes('auto_increment');
    
    console.log(`\n🔍 ID Column Analysis:`);
    console.log(`   Has id column: ${hasIdColumn}`);
    console.log(`   Is auto_increment: ${isIdPrimary}`);
    
    if (!hasIdColumn || !isIdPrimary) {
      console.log("🔧 Adding/fixing id column...");
      
      try {
        // If table has data but no proper id, we need to handle it
        if (hasIdColumn && !isIdPrimary) {
          // Check if there's data
          const [countResult] = await sequelize.query(`
            SELECT COUNT(*) as count FROM sl_formation_packages
          `);
          const hasData = countResult[0].count > 0;
          
          if (hasData) {
            console.log("⚠️  Table has data, creating backup and fixing structure...");
            
            // Create backup
            await sequelize.query(`
              CREATE TABLE sl_formation_packages_backup AS SELECT * FROM sl_formation_packages
            `);
            console.log("   ✅ Created backup table");
          }
          
          // Drop and recreate table with proper structure
          await sequelize.query(`DROP TABLE sl_formation_packages`);
          console.log("   🗑️  Dropped old table");
        }
        
        // Create table with proper structure
        await sequelize.query(`
          CREATE TABLE sl_formation_packages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL DEFAULT 0,
            currency VARCHAR(3) DEFAULT 'XAF',
            target_audience VARCHAR(255),
            status ENUM('active', 'inactive', 'draft') DEFAULT 'active',
            image_url VARCHAR(500),
            benefits JSON,
            prerequisites JSON,
            duration_months INT DEFAULT 1,
            max_participants INT DEFAULT 1,
            created_by VARCHAR(255),
            promotion_status ENUM('none', 'active', 'expired') DEFAULT 'none',
            promotion_discount_percent DECIMAL(5,2) DEFAULT 0,
            promotion_start_date DATETIME,
            promotion_end_date DATETIME,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log("   ✅ Created sl_formation_packages with proper id column");
        
        // Restore data if backup exists
        const [backupExists] = await sequelize.query(`
          SELECT COUNT(*) as count FROM information_schema.tables 
          WHERE table_schema = DATABASE() AND table_name = 'sl_formation_packages_backup'
        `);
        
        if (backupExists[0].count > 0) {
          console.log("   🔄 Restoring data from backup...");
          
          // Get columns from backup (excluding id)
          const [backupColumns] = await sequelize.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = DATABASE() AND table_name = 'sl_formation_packages_backup'
            AND column_name != 'id'
          `);
          
          const columnList = backupColumns.map(col => col.column_name).join(', ');
          
          await sequelize.query(`
            INSERT INTO sl_formation_packages (${columnList})
            SELECT ${columnList} FROM sl_formation_packages_backup
          `);
          
          // Drop backup
          await sequelize.query(`DROP TABLE sl_formation_packages_backup`);
          console.log("   ✅ Data restored and backup cleaned up");
        }
        
      } catch (error) {
        console.error("   ❌ Failed to fix sl_formation_packages:", error.message);
        throw error;
      }
    } else {
      console.log("   ✅ sl_formation_packages already has proper id column");
    }
    
    // Now fix sl_company_packages foreign key
    console.log("\n🔧 Fixing sl_company_packages foreign key...");
    
    // Drop existing foreign key if it exists
    try {
      await sequelize.query(`
        ALTER TABLE sl_company_packages DROP FOREIGN KEY fk_company_packages_package
      `);
      console.log("   🗑️  Dropped existing foreign key");
    } catch (error) {
      console.log("   ℹ️  No existing foreign key to drop");
    }
    
    // Add the correct foreign key
    await sequelize.query(`
      ALTER TABLE sl_company_packages 
      ADD CONSTRAINT fk_company_packages_package 
      FOREIGN KEY (package_id) REFERENCES sl_formation_packages(id) 
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
    console.log("   ✅ Added correct foreign key: package_id -> sl_formation_packages.id");
    
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
    
    // Test foreign key constraint
    try {
      await sequelize.query(`
        INSERT INTO sl_company_packages (company_id, package_id, total_licenses, purchase_date) 
        VALUES (1, 1, 1, NOW())
      `);
      await sequelize.query(`
        DELETE FROM sl_company_packages WHERE company_id = 1 AND package_id = 1
      `);
      console.log("   ✅ Foreign key constraint working correctly");
    } catch (error) {
      console.error("   ❌ Foreign key constraint test failed:", error.message);
    }
    
    console.log("\n🎉 sl_formation_packages fix completed successfully!");
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Fix failed:", error);
    console.error("Details:", error.message);
    process.exit(1);
  }
};

// Run fix
fixFormationPackages();
