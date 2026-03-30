#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const migrateDatabase = async () => {
  try {
    console.log("🔄 Starting FIXED production migration...");
    
    // Test connection first
    await sequelize.authenticate();
    console.log("✅ Database connection established.");
    
    // Get all models in dependency order
    const models = sequelize.models;
    const modelNames = Object.keys(models);
    
    console.log("📋 Models to sync in dependency order:");
    
    // Define dependency order (models without foreign keys first)
    const dependencyOrder = [
      'ApiKey',
      'VerifiedEmail', 
      'AdminAuditLog',
      'ProviderStatsCache',
      'NotificationSettings',
      'OrderAuditLog',
      'AdminNotification',
      'PaymentProvider',
      'PaymentIntent',
      'PaymentAttempt',
      'ProviderRoute',
      'WebhookEvent',
      'InstallmentPlan',
      'InstallmentPayment',
      'Order',
      'Company',
      'CompanyAdmin',
      'Employee',
      'FormationPackage',
      'Course',
      'PostMeta',
      'PackageFormation',
      'SpecificFormation',
      'CompanyPackage',
      'AccessRequest'
    ];
    
    // Sync models one by one in dependency order
    for (const modelName of dependencyOrder) {
      if (models[modelName]) {
        console.log(`   🔄 Syncing ${modelName}...`);
        try {
          await models[modelName].sync({ alter: false, force: false });
          console.log(`   ✅ ${modelName} synced successfully`);
        } catch (error) {
          console.error(`   ❌ Failed to sync ${modelName}:`, error.message);
          
          // Try to create table without foreign keys first
          if (error.message.includes('Foreign key constraint')) {
            console.log(`   🔧 Attempting to create ${modelName} without foreign keys...`);
            try {
              // Get the model's attributes
              const attributes = models[modelName].rawAttributes;
              
              // Remove foreign key constraints temporarily
              const cleanAttributes = {};
              Object.keys(attributes).forEach(key => {
                const attr = attributes[key];
                cleanAttributes[key] = {
                  ...attr,
                  references: undefined,
                  referencesKey: undefined,
                  onUpdate: undefined,
                  onDelete: undefined
                };
              });
              
              // Create table without foreign keys
              await sequelize.getQueryInterface().createTable(
                models[modelName].tableName,
                cleanAttributes
              );
              
              console.log(`   ✅ ${modelName} created without foreign keys`);
              
              // Add foreign keys separately
              await addForeignKeys(models[modelName]);
              console.log(`   ✅ Foreign keys added for ${modelName}`);
              
            } catch (fkError) {
              console.error(`   ❌ Failed to create ${modelName} without foreign keys:`, fkError.message);
              throw fkError;
            }
          } else {
            throw error;
          }
        }
      }
    }
    
    // Verify tables exist
    const [results] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      ORDER BY table_name
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

// Helper function to add foreign keys separately
const addForeignKeys = async (model) => {
  const queryInterface = sequelize.getQueryInterface();
  const tableName = model.tableName;
  const attributes = model.rawAttributes;
  
  // Define foreign key constraints based on model
  const foreignKeys = {};
  
  if (tableName === 'sl_company_packages') {
    foreignKeys.company_id = {
      table: 'sl_companies',
      field: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    };
    foreignKeys.package_id = {
      table: 'sl_formation_packages', 
      field: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    };
  }
  
  // Add foreign keys one by one
  for (const [field, constraint] of Object.entries(foreignKeys)) {
    try {
      await queryInterface.addConstraint(tableName, {
        fields: [field],
        type: 'foreign key',
        name: `fk_${tableName}_${field}`,
        references: {
          table: constraint.table,
          field: constraint.field
        },
        onDelete: constraint.onDelete,
        onUpdate: constraint.onUpdate
      });
      console.log(`   ✅ Added foreign key: ${field} -> ${constraint.table}.${constraint.field}`);
    } catch (fkError) {
      console.warn(`   ⚠️  Could not add foreign key ${field}:`, fkError.message);
    }
  }
};

// Run migration
migrateDatabase();
