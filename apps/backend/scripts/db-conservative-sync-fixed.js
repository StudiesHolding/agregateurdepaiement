#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const runConservativeSync = async () => {
  try {
    console.log("🔧 DÉBUT DE LA SYNCHRONISATION CONSERVATRICE (CORRIGÉE)");
    console.log("=" .repeat(80));
    console.log("⚠️  APPROCHE CONSERVATRICE - Ajout uniquement des colonnes manquantes");
    console.log("📦 BACKUP AUTOMATIQUE AVANT CHAQUE MODIFICATION");
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    // Load diagnostic results if available
    let diagnosticResults = null;
    const diagnosticPath = path.join(process.cwd(), 'database-diagnostic-report.json');
    
    if (fs.existsSync(diagnosticPath)) {
      diagnosticResults = JSON.parse(fs.readFileSync(diagnosticPath, 'utf8'));
      console.log("📋 Rapport de diagnostic chargé");
    } else {
      console.log("⚠️  Aucun rapport de diagnostic trouvé - Exécution d'un diagnostic rapide...");
      // Run quick diagnostic first
      await runQuickDiagnostic();
      if (fs.existsSync(diagnosticPath)) {
        diagnosticResults = JSON.parse(fs.readFileSync(diagnosticPath, 'utf8'));
      }
    }
    
    if (!diagnosticResults || diagnosticResults.columnMismatches.length === 0) {
      console.log("🎉 Aucune synchronisation nécessaire - La base de données est déjà à jour");
      process.exit(0);
    }
    
    console.log(`📊 ${diagnosticResults.columnMismatches.length} modèles nécessitent des corrections\n`);
    
    // Process each model with column mismatches
    for (const mismatch of diagnosticResults.columnMismatches) {
      await syncModel(mismatch);
    }
    
    console.log("\n" + "=".repeat(80));
    console.log("🎉 SYNCHRONISATION CONSERVATRICE TERMINÉE");
    console.log("=".repeat(80));
    
    // Run validation
    console.log("🧪 Validation post-synchronisation...");
    await runValidation();
    
    console.log("✅ Base de données synchronisée avec succès !");
    
  } catch (error) {
    console.error("❌ Erreur lors de la synchronisation:", error);
    console.error("Détails:", error.message);
    
    // Attempt rollback if possible
    console.log("🔄 Tentative de rollback...");
    await attemptRollback();
    
    process.exit(1);
  }
};

const syncModel = async (mismatch) => {
  const { model: modelName, table: tableName, missingColumns } = mismatch;
  
  console.log(`\n🔧 Synchronisation: ${modelName} → ${tableName}`);
  console.log(`   Colonnes à ajouter: ${missingColumns.join(', ')}`);
  
  try {
    // Create backup
    const backupName = `backup_${tableName}_${Date.now()}`;
    await sequelize.query(`CREATE TABLE ${backupName} AS SELECT * FROM ${tableName}`);
    console.log(`   📦 Backup créé: ${backupName}`);
    
    // Import the model to get column definitions
    const model = sequelize.models[modelName];
    
    // Add each missing column
    for (const columnName of missingColumns) {
      const columnDef = model.rawAttributes[columnName];
      await addColumn(tableName, columnName, columnDef);
      console.log(`   ✅ Colonne ajoutée: ${columnName}`);
    }
    
    // Verify the changes
    await verifyTable(tableName, model);
    console.log(`   ✅ Table ${tableName} vérifiée avec succès`);
    
  } catch (error) {
    console.error(`   ❌ Erreur lors de la synchronisation de ${tableName}:`, error.message);
    throw error;
  }
};

const addColumn = async (tableName, columnName, columnDef) => {
  const sqlType = getSQLType(columnDef.type);
  const defaultValue = columnDef.defaultValue ? `DEFAULT ${typeof columnDef.defaultValue === 'string' ? `'${columnDef.defaultValue}'` : columnDef.defaultValue}` : '';
  const nullable = columnDef.allowNull ? '' : 'NOT NULL';
  
  // Find the best position for the new column
  const afterClause = await getBestAfterClause(tableName);
  
  const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlType} ${defaultValue} ${nullable} ${afterClause}`;
  
  await sequelize.query(sql);
};

const getBestAfterClause = async (tableName) => {
  try {
    // Get existing columns to find the best position
    const [columns] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `);
    
    const columnNames = columns.map(col => col.column_name);
    
    // Try to place after common timestamp columns, or at the end
    const preferredPositions = ['updated_at', 'created_at', 'id'];
    
    for (const preferred of preferredPositions) {
      if (columnNames.includes(preferred)) {
        return `AFTER ${preferred}`;
      }
    }
    
    // If no preferred position found, place at the end
    return '';
    
  } catch (error) {
    console.warn(`   ⚠️  Impossible de déterminer la position pour ${tableName}: ${error.message}`);
    return '';
  }
};

const verifyTable = async (tableName, model) => {
  // Check if all model columns exist
  const modelColumns = Object.keys(model.rawAttributes);
  const [tableColumns] = await sequelize.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema = DATABASE() AND table_name = '${tableName}'
  `);
  
  const actualColumns = tableColumns.map(col => col.column_name);
  const missingColumns = modelColumns.filter(col => !actualColumns.includes(col));
  
  if (missingColumns.length > 0) {
    throw new Error(`Colonnes manquantes après synchronisation: ${missingColumns.join(', ')}`);
  }
  
  // Test basic model operations
  try {
    await model.findOne({ limit: 1 });
    await model.count();
  } catch (error) {
    throw new Error(`Test du modèle ${modelName} échoué: ${error.message}`);
  }
};

const runQuickDiagnostic = async () => {
  console.log("🔍 Diagnostic rapide...");
  
  const models = sequelize.models;
  const modelNames = Object.keys(models);
  
  // Get existing tables
  const [existingTables] = await sequelize.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = DATABASE()
  `);
  
  const tableNames = existingTables.map(t => t.table_name);
  const columnMismatches = [];
  
  for (const modelName of modelNames) {
    const model = models[modelName];
    const tableName = model.tableName;
    
    if (!tableNames.includes(tableName)) continue;
    
    const modelColumns = Object.keys(model.rawAttributes);
    
    const [tableColumns] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = '${tableName}'
    `);
    
    const actualColumns = tableColumns.map(col => col.column_name);
    const missingColumns = modelColumns.filter(col => !actualColumns.includes(col));
    
    if (missingColumns.length > 0) {
      columnMismatches.push({
        model: modelName,
        table: tableName,
        missingColumns,
        extraColumns: []
      });
    }
  }
  
  const diagnosticResults = {
    totalModels: modelNames.length,
    totalTables: tableNames.length,
    modelTableMatches: modelNames.length - columnMismatches.length,
    missingTables: [],
    extraTables: [],
    columnMismatches,
    foreignKeyIssues: [],
    summary: {
      criticalIssues: columnMismatches.reduce((sum, m) => sum + m.missingColumns.length, 0),
      warnings: 0,
      info: 0
    }
  };
  
  const diagnosticPath = path.join(process.cwd(), 'database-diagnostic-report.json');
  fs.writeFileSync(diagnosticPath, JSON.stringify(diagnosticResults, null, 2));
  
  console.log(`📋 Diagnostic rapide terminé: ${columnMismatches.length} modèles avec problèmes`);
};

const runValidation = async () => {
  console.log("🧪 Validation de tous les modèles...");
  
  const models = sequelize.models;
  const validationResults = [];
  
  for (const [modelName, model] of Object.entries(models)) {
    try {
      // Test basic operations
      await model.count();
      await model.findOne({ limit: 1 });
      
      validationResults.push({ model: modelName, status: 'success', error: null });
      console.log(`   ✅ ${modelName}`);
      
    } catch (error) {
      validationResults.push({ model: modelName, status: 'error', error: error.message });
      console.log(`   ❌ ${modelName}: ${error.message}`);
    }
  }
  
  const successCount = validationResults.filter(r => r.status === 'success').length;
  const errorCount = validationResults.filter(r => r.status === 'error').length;
  
  console.log(`\n📊 Résultats validation: ${successCount} succès, ${errorCount} erreurs`);
  
  if (errorCount > 0) {
    console.log("⚠️  Certains modèles ont encore des problèmes:");
    validationResults.filter(r => r.status === 'error').forEach(r => {
      console.log(`   ❌ ${r.model}: ${r.error}`);
    });
  }
  
  // Save validation results
  const validationPath = path.join(process.cwd(), 'database-validation-report.json');
  fs.writeFileSync(validationPath, JSON.stringify(validationResults, null, 2));
};

const attemptRollback = async () => {
  try {
    console.log("🔄 Recherche des tables de backup...");
    
    const [backupTables] = await sequelize.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name LIKE 'backup_%'
    `);
    
    if (backupTables.length === 0) {
      console.log("ℹ️  Aucune table de backup trouvée");
      return;
    }
    
    for (const backup of backupTables) {
      const backupName = backup.table_name;
      const originalName = backupName.replace(/^backup_\d+_/g, '');
      
      try {
        await sequelize.query(`DROP TABLE ${originalName}`);
        await sequelize.query(`RENAME TABLE ${backupName} TO ${originalName}`);
        console.log(`   ✅ Rollback: ${backupName} → ${originalName}`);
      } catch (rollbackError) {
        console.log(`   ❌ Rollback échoué pour ${backupName}: ${rollbackError.message}`);
      }
    }
    
  } catch (error) {
    console.error("❌ Erreur lors du rollback:", error.message);
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
};

// Run conservative sync
runConservativeSync();
