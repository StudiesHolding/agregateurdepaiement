#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const runFullDiagnostic = async () => {
  try {
    console.log("🔍 DÉBUT DU DIAGNOSTIC COMPLET DE LA BASE DE DONNÉES");
    console.log("=" .repeat(80));
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    // Get all models
    const models = sequelize.models;
    const modelNames = Object.keys(models);
    
    console.log(`📋 Analyse de ${modelNames.length} modèles vs tables réelles...\n`);
    
    // Get all existing tables
    const [existingTables] = await sequelize.query(`
      SELECT table_name, table_comment 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      ORDER BY table_name
    `);
    
    const tableNames = existingTables.map(t => t.table_name);
    
    // Diagnostic results
    const diagnosticResults = {
      totalModels: modelNames.length,
      totalTables: tableNames.length,
      modelTableMatches: 0,
      missingTables: [],
      extraTables: [],
      columnMismatches: [],
      foreignKeyIssues: [],
      summary: {
        criticalIssues: 0,
        warnings: 0,
        info: 0
      }
    };
    
    console.log("📊 RAPPORT DÉTAILLÉ PAR MODÈLE:");
    console.log("-".repeat(80));
    
    // Analyze each model
    for (const modelName of modelNames) {
      const model = models[modelName];
      const tableName = model.tableName;
      
      console.log(`\n🔍 Modèle: ${modelName} → Table: ${tableName}`);
      
      // Check if table exists
      const tableExists = tableNames.includes(tableName);
      
      if (!tableExists) {
        console.log(`   ❌ TABLE MANQUANTE: ${tableName}`);
        diagnosticResults.missingTables.push({ model: modelName, table: tableName });
        diagnosticResults.summary.criticalIssues++;
        continue;
      }
      
      diagnosticResults.modelTableMatches++;
      
      // Get model columns
      const modelColumns = Object.keys(model.rawAttributes);
      
      // Get actual table columns
      const [tableColumns] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default, extra
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() AND table_name = '${tableName}'
        ORDER BY ordinal_position
      `);
      
      const actualColumns = tableColumns.map(col => col.column_name);
      
      // Find missing columns
      const missingColumns = modelColumns.filter(col => !actualColumns.includes(col));
      
      // Find extra columns
      const extraColumns = actualColumns.filter(col => !modelColumns.includes(col));
      
      if (missingColumns.length > 0) {
        console.log(`   ⚠️  COLONNES MANQUANTES: ${missingColumns.join(', ')}`);
        diagnosticResults.columnMismatches.push({
          model: modelName,
          table: tableName,
          missingColumns,
          extraColumns
        });
        diagnosticResults.summary.criticalIssues += missingColumns.length;
      }
      
      if (extraColumns.length > 0) {
        console.log(`   ℹ️  COLONNES SUPPLÉMENTAIRES: ${extraColumns.join(', ')}`);
        diagnosticResults.summary.warnings += extraColumns.length;
      }
      
      if (missingColumns.length === 0 && extraColumns.length === 0) {
        console.log(`   ✅ Structure synchronisée`);
        diagnosticResults.summary.info++;
      }
      
      // Check for foreign key issues
      try {
        const [foreignKeys] = await sequelize.query(`
          SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
          FROM information_schema.KEY_COLUMN_USAGE 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' 
          AND REFERENCED_TABLE_NAME IS NOT NULL
        `);
        
        if (foreignKeys.length > 0) {
          console.log(`   🔗 Foreign keys: ${foreignKeys.map(fk => fk.COLUMN_NAME + '→' + fk.REFERENCED_TABLE_NAME + '.' + fk.REFERENCED_COLUMN_NAME).join(', ')}`);
        }
      } catch (fkError) {
        console.log(`   ❌ Erreur foreign keys: ${fkError.message}`);
        diagnosticResults.foreignKeyIssues.push({ model: modelName, error: fkError.message });
        diagnosticResults.summary.criticalIssues++;
      }
    }
    
    // Check for extra tables (not mapped to models)
    const modelTableNames = modelNames.map(name => models[name].tableName);
    const extraTables = tableNames.filter(tableName => !modelTableNames.includes(tableName));
    
    if (extraTables.length > 0) {
      console.log(`\n📋 TABLES SANS MODÈLE CORRESPONDANT:`);
      extraTables.forEach(table => {
        console.log(`   ℹ️  ${table}`);
      });
      diagnosticResults.extraTables = extraTables;
      diagnosticResults.summary.warnings += extraTables.length;
    }
    
    // Generate summary report
    console.log("\n" + "=".repeat(80));
    console.log("📊 RÉSUMÉ DU DIAGNOSTIC");
    console.log("=".repeat(80));
    console.log(`📈 Statistiques:`);
    console.log(`   • Modèles analysés: ${diagnosticResults.totalModels}`);
    console.log(`   • Tables existantes: ${diagnosticResults.totalTables}`);
    console.log(`   • Correspondances: ${diagnosticResults.modelTableMatches}`);
    console.log(`   • Tables manquantes: ${diagnosticResults.missingTables.length}`);
    console.log(`   • Tables sans modèle: ${diagnosticResults.extraTables.length}`);
    console.log(`   • Problèmes colonnes: ${diagnosticResults.columnMismatches.length}`);
    console.log(`   • Problèmes foreign keys: ${diagnosticResults.foreignKeyIssues.length}`);
    
    console.log(`\n🚨 Niveau de sévérité:`);
    console.log(`   • Problèmes critiques: ${diagnosticResults.summary.criticalIssues}`);
    console.log(`   • Avertissements: ${diagnosticResults.summary.warnings}`);
    console.log(`   • Informations: ${diagnosticResults.summary.info}`);
    
    // Save detailed report to file
    const reportPath = path.join(process.cwd(), 'database-diagnostic-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(diagnosticResults, null, 2));
    console.log(`\n💾 Rapport détaillé sauvegardé: ${reportPath}`);
    
    // Generate SQL fix suggestions
    console.log("\n🔧 SUGGESTIONS DE CORRECTION SQL:");
    console.log("-".repeat(80));
    
    for (const mismatch of diagnosticResults.columnMismatches) {
      console.log(`\n-- ${mismatch.model} (${mismatch.table})`);
      for (const column of mismatch.missingColumns) {
        const modelAttr = models[mismatch.model].rawAttributes[column];
        const sqlType = getSQLType(modelAttr.type);
        const defaultValue = modelAttr.defaultValue ? `DEFAULT ${modelAttr.defaultValue}` : '';
        const nullable = modelAttr.allowNull ? '' : 'NOT NULL';
        
        console.log(`ALTER TABLE ${mismatch.table} ADD COLUMN ${column} ${sqlType} ${defaultValue} ${nullable};`);
      }
    }
    
    console.log("\n" + "=".repeat(80));
    if (diagnosticResults.summary.criticalIssues === 0) {
      console.log("🎉 DIAGNOSTIC TERMINÉ - Aucun problème critique détecté");
    } else {
      console.log(`⚠️  DIAGNOSTIC TERMINÉ - ${diagnosticResults.summary.criticalIssues} problèmes critiques à résoudre`);
      console.log("   Exécutez: npm run db:conservative-sync");
    }
    
    process.exit(diagnosticResults.summary.criticalIssues > 0 ? 1 : 0);
    
  } catch (error) {
    console.error("❌ Erreur lors du diagnostic:", error);
    console.error("Détails:", error.message);
    process.exit(1);
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

// Run diagnostic
runFullDiagnostic();
