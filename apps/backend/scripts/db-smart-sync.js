#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const runSmartSync = async () => {
  try {
    console.log("🧠 DÉBUT DE LA SYNCHRONISATION INTELLIGENTE");
    console.log("=" .repeat(80));
    console.log("🔍 Diagnostic en temps réel - Vérification de l'état actuel");
    console.log("⚡ Ajout uniquement des colonnes réellement manquantes");
    console.log("📦 BACKUP AUTOMATIQUE AVANT CHAQUE MODIFICATION");
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    const models = sequelize.models;
    const modelNames = Object.keys(models);
    
    console.log(`📊 Analyse de ${modelNames.length} modèles en temps réel\n`);
    
    let totalTablesProcessed = 0;
    let totalColumnsAdded = 0;
    let totalSkipped = 0;
    
    // Process each model individually with real-time checking
    for (const modelName of modelNames) {
      const model = models[modelName];
      const tableName = model.tableName;
      
      console.log(`\n🔍 Analyse: ${modelName} → ${tableName}`);
      
      // Check if table exists
      const [tableExists] = await sequelize.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_schema = DATABASE() AND table_name = '${tableName}'
      `);
      
      if (tableExists[0].count === 0) {
        console.log(`   ⚠️  Table ${tableName} n'existe pas - skipped`);
        totalSkipped++;
        continue;
      }
      
      // Get real-time column information
      const [actualColumns] = await sequelize.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = DATABASE() AND table_name = '${tableName}'
        ORDER BY ordinal_position
      `);
      
      const actualColumnNames = actualColumns.map(col => col.column_name);
      const modelColumns = Object.keys(model.rawAttributes);
      
      // Find actually missing columns
      const missingColumns = modelColumns.filter(col => !actualColumnNames.includes(col));
      
      if (missingColumns.length === 0) {
        console.log(`   ✅ Table déjà synchronisée - ${actualColumnNames.length} colonnes`);
        totalTablesProcessed++;
        continue;
      }
      
      console.log(`   📋 Colonnes manquantes: ${missingColumns.join(', ')}`);
      console.log(`   📋 Colonnes existantes: ${actualColumnNames.join(', ')}`);
      
      // Create backup before modifying
      const backupName = `backup_${tableName}_${Date.now()}`;
      await sequelize.query(`CREATE TABLE ${backupName} AS SELECT * FROM ${tableName}`);
      console.log(`   📦 Backup créé: ${backupName}`);
      
      // Add each missing column
      let columnsAddedForThisTable = 0;
      for (const columnName of missingColumns) {
        try {
          const columnDef = model.rawAttributes[columnName];
          await addColumnSafely(tableName, columnName, columnDef, actualColumnNames);
          console.log(`   ✅ Colonne ajoutée: ${columnName}`);
          columnsAddedForThisTable++;
          totalColumnsAdded++;
        } catch (error) {
          console.log(`   ⚠️  Échec ajout ${columnName}: ${error.message}`);
        }
      }
      
      // Verify the table after modifications
      try {
        await model.count();
        await model.findOne({ limit: 1 });
        console.log(`   ✅ Table ${tableName} vérifiée avec succès`);
        totalTablesProcessed++;
      } catch (verifyError) {
        console.log(`   ❌ Erreur vérification ${tableName}: ${verifyError.message}`);
        // Try to restore from backup
        try {
          await sequelize.query(`DROP TABLE ${tableName}`);
          await sequelize.query(`RENAME TABLE ${backupName} TO ${tableName}`);
          console.log(`   🔄 Table ${tableName} restaurée depuis backup`);
        } catch (restoreError) {
          console.log(`   ❌ Impossible de restaurer ${tableName}: ${restoreError.message}`);
        }
      }
      
      console.log(`   📊 ${columnsAddedForThisTable} colonnes ajoutées pour ${tableName}`);
    }
    
    console.log("\n" + "=".repeat(80));
    console.log("🎉 SYNCHRONISATION INTELLIGENTE TERMINÉE");
    console.log("=".repeat(80));
    console.log(`📊 Statistiques finales:`);
    console.log(`   • Tables traitées: ${totalTablesProcessed}/${modelNames.length}`);
    console.log(`   • Colonnes ajoutées: ${totalColumnsAdded}`);
    console.log(`   • Tables ignorées: ${totalSkipped}`);
    
    // Run final validation
    console.log("\n🧪 Validation finale...");
    await runFinalValidation();
    
    console.log("✅ Base de données synchronisée avec succès !");
    
  } catch (error) {
    console.error("❌ Erreur lors de la synchronisation:", error);
    console.error("Détails:", error.message);
    process.exit(1);
  }
};

const addColumnSafely = async (tableName, columnName, columnDef, existingColumns) => {
  const sqlType = getSQLType(columnDef.type);
  const defaultValue = getDefaultValue(columnDef);
  const nullable = columnDef.allowNull ? '' : 'NOT NULL';
  
  // Find safe position - after an existing column
  const afterClause = getSafeAfterClause(existingColumns);
  
  const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlType} ${defaultValue} ${nullable} ${afterClause}`;
  
  await sequelize.query(sql);
};

const getSafeAfterClause = (existingColumns) => {
  // Prefer to place after common columns, or at the end
  const preferredColumns = ['updated_at', 'created_at', 'id', 'modified_at'];
  
  for (const preferred of preferredColumns) {
    if (existingColumns.includes(preferred)) {
      return `AFTER ${preferred}`;
    }
  }
  
  // Place at the end if no preferred column found
  return '';
};

const getDefaultValue = (columnDef) => {
  if (!columnDef.defaultValue) {
    return '';
  }
  
  let defaultValue = columnDef.defaultValue;
  
  // Handle special default values
  if (defaultValue === DataTypes.NOW || defaultValue === 'NOW') {
    return 'DEFAULT CURRENT_TIMESTAMP';
  }
  
  if (typeof defaultValue === 'string') {
    // Handle function calls
    if (defaultValue.includes('NOW') || defaultValue.includes('CURRENT_TIMESTAMP')) {
      return 'DEFAULT CURRENT_TIMESTAMP';
    }
    return `DEFAULT '${defaultValue}'`;
  }
  
  if (typeof defaultValue === 'boolean') {
    return `DEFAULT ${defaultValue ? '1' : '0'}`;
  }
  
  if (typeof defaultValue === 'number') {
    return `DEFAULT ${defaultValue}`;
  }
  
  return '';
};

const runFinalValidation = async () => {
  console.log("🧪 Validation de tous les modèles...");
  
  const models = sequelize.models;
  let successCount = 0;
  let errorCount = 0;
  
  for (const [modelName, model] of Object.entries(models)) {
    try {
      // Test basic operations
      await model.count();
      await model.findOne({ limit: 1 });
      
      successCount++;
      console.log(`   ✅ ${modelName}`);
      
    } catch (error) {
      errorCount++;
      console.log(`   ❌ ${modelName}: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Résultats validation: ${successCount} succès, ${errorCount} erreurs`);
  
  // Save validation results
  const validationResults = {
    timestamp: new Date().toISOString(),
    totalModels: Object.keys(models).length,
    successCount,
    errorCount,
    status: errorCount === 0 ? 'SUCCESS' : 'PARTIAL'
  };
  
  const validationPath = path.join(process.cwd(), 'database-validation-report.json');
  fs.writeFileSync(validationPath, JSON.stringify(validationResults, null, 2));
  
  if (errorCount === 0) {
    console.log("🎉 TOUS LES MODÈLES FONCTIONNENT CORRECTEMENT !");
  } else {
    console.log("⚠️  Certains modèles ont encore des problèmes - voir le rapport");
  }
};

// Helper function to convert Sequelize type to SQL type
function getSQLType(sequelizeType) {
  if (sequelizeType.key) {
    switch (sequelizeType.key) {
      case 'INTEGER': return 'INT';
      case 'STRING': return `VARCHAR(${sequelizeType._length || 255})`;
      case 'TEXT': return 'TEXT';
      case 'DECIMAL': return `DECIMAL(${sequelizeType._precision || 10}, ${sequelizeType._scale || 2})`;
      case 'BOOLEAN': return 'BOOLEAN';
      case 'DATE': return 'DATETIME';
      case 'JSON': return 'JSON';
      case 'ENUM': return `ENUM(${sequelizeType.values.map(v => `'${v}'`).join(', ')})`;
      default: return 'VARCHAR(255)';
    }
  }
  return 'VARCHAR(255)';
}

// Import DataTypes for default value handling
import { DataTypes } from "sequelize";

// Run smart sync
runSmartSync();
