#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const fixPackageFormation = async () => {
  try {
    console.log("🔧 CORRECTION SPÉCIFIQUE - PackageFormation");
    console.log("=" .repeat(60));
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    const tableName = 'sl_package_formations';
    
    // Check current table structure
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `);
    
    console.log("📋 Structure actuelle:");
    columns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    const actualColumns = columns.map(col => col.column_name);
    
    // Check what's missing based on the model
    const expectedColumns = ['id', 'package_id', 'formation_type', 'global_formation_id', 'package_formation_id', 'formation_id', 'order'];
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
    
    console.log(`\n🔍 Colonnes attendues: ${expectedColumns.join(', ')}`);
    console.log(`🔍 Colonnes existantes: ${actualColumns.join(', ')}`);
    console.log(`❌ Colonnes manquantes: ${missingColumns.join(', ')}`);
    
    if (missingColumns.length === 0) {
      console.log("✅ Toutes les colonnes existent déjà !");
      
      // Test the model
      const { PackageFormation } = await import("../models/package-formation.model.js");
      
      try {
        await PackageFormation.count();
        await PackageFormation.findOne({ limit: 1 });
        console.log("✅ PackageFormation fonctionne correctement !");
        
        // Run final validation
        await runQuickValidation();
        
      } catch (error) {
        console.log(`❌ Erreur modèle: ${error.message}`);
        
        // Try to identify the specific issue
        if (error.message.includes('formation_id')) {
          console.log("🔧 Problème avec formation_id - vérification...");
          
          // Check if there's a specific issue with formation_id
          const [formationIdColumn] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = DATABASE() AND table_name = '${tableName}' AND column_name = 'formation_id'
          `);
          
          if (formationIdColumn.length === 0) {
            console.log("🔧 Ajout de la colonne formation_id...");
            
            // Create backup
            const backupName = `backup_${tableName}_${Date.now()}`;
            await sequelize.query(`CREATE TABLE ${backupName} AS SELECT * FROM ${tableName}`);
            console.log(`   📦 Backup créé: ${backupName}`);
            
            // Add the missing column
            await sequelize.query(`
              ALTER TABLE ${tableName} ADD COLUMN formation_id INT NULL
            `);
            console.log("   ✅ Colonne formation_id ajoutée");
            
            // Test again
            try {
              await PackageFormation.count();
              await PackageFormation.findOne({ limit: 1 });
              console.log("✅ PackageFormation fonctionne maintenant !");
              
              await runQuickValidation();
              
            } catch (testError) {
              console.log(`❌ Erreur persistante: ${testError.message}`);
              // Restore backup
              await sequelize.query(`DROP TABLE ${tableName}`);
              await sequelize.query(`RENAME TABLE ${backupName} TO ${tableName}`);
              console.log("   🔄 Table restaurée depuis backup");
            }
          }
        }
      }
      
    } else {
      console.log(`🔧 Ajout des colonnes manquantes: ${missingColumns.join(', ')}`);
      
      // Create backup
      const backupName = `backup_${tableName}_${Date.now()}`;
      await sequelize.query(`CREATE TABLE ${backupName} AS SELECT * FROM ${tableName}`);
      console.log(`   📦 Backup créé: ${backupName}`);
      
      // Add missing columns
      for (const column of missingColumns) {
        try {
          let sqlType = 'INT';
          let nullable = column === 'id' ? 'NOT NULL' : 'NULL';
          let defaultValue = '';
          
          if (column === 'formation_type') {
            sqlType = "ENUM('global', 'package_specific')";
            defaultValue = "DEFAULT 'global'";
          } else if (column === 'order') {
            defaultValue = 'DEFAULT 0';
          }
          
          await sequelize.query(`
            ALTER TABLE ${tableName} ADD COLUMN ${column} ${sqlType} ${defaultValue} ${nullable}
          `);
          console.log(`   ✅ Colonne ajoutée: ${column}`);
          
        } catch (error) {
          console.log(`   ❌ Erreur ajout ${column}: ${error.message}`);
        }
      }
      
      // Test the model
      try {
        const { PackageFormation } = await import("../models/package-formation.model.js");
        await PackageFormation.count();
        await PackageFormation.findOne({ limit: 1 });
        console.log("✅ PackageFormation fonctionne maintenant !");
        
        await runQuickValidation();
        
      } catch (error) {
        console.log(`❌ Erreur modèle après correction: ${error.message}`);
      }
    }
    
    console.log("\n🎉 Correction PackageFormation terminée !");
    
  } catch (error) {
    console.error("❌ Erreur lors de la correction:", error);
    console.error("Détails:", error.message);
    process.exit(1);
  }
};

const runQuickValidation = async () => {
  console.log("\n🧪 Validation rapide de tous les modèles...");
  
  const models = sequelize.models;
  let successCount = 0;
  let errorCount = 0;
  
  for (const [modelName, model] of Object.entries(models)) {
    try {
      await model.count();
      successCount++;
    } catch (error) {
      errorCount++;
      console.log(`   ❌ ${modelName}: ${error.message}`);
    }
  }
  
  console.log(`📊 Résultats: ${successCount} succès, ${errorCount} erreurs`);
  
  if (errorCount === 0) {
    console.log("🎉 TOUS LES MODÈLES FONCTIONNENT CORRECTEMENT !");
    console.log("✅ Votre workflow B2B est maintenant 100% opérationnel !");
  }
};

// Run fix
fixPackageFormation();
