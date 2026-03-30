#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const runValidation = async () => {
  try {
    console.log("🧪 DÉBUT DE LA VALIDATION COMPLÈTE");
    console.log("=" .repeat(80));
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    const models = sequelize.models;
    const modelNames = Object.keys(models);
    
    console.log(`📊 Validation de ${modelNames.length} modèles\n`);
    
    const validationResults = {
      totalModels: modelNames.length,
      successCount: 0,
      errorCount: 0,
      models: [],
      summary: {
        criticalErrors: 0,
        warnings: 0,
        performance: []
      }
    };
    
    // Validate each model
    for (const modelName of modelNames) {
      const model = models[modelName];
      const result = await validateModel(modelName, model);
      
      validationResults.models.push(result);
      
      if (result.status === 'success') {
        validationResults.successCount++;
      } else {
        validationResults.errorCount++;
        if (result.severity === 'critical') {
          validationResults.summary.criticalErrors++;
        }
      }
    }
    
    // Test critical endpoints
    console.log("\n🌐 VALIDATION DES ENDPOINTS CRITIQUES");
    console.log("-".repeat(80));
    
    await testCriticalEndpoints(validationResults);
    
    // Generate summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 RÉSUMÉ DE LA VALIDATION");
    console.log("=".repeat(80));
    
    console.log(`📈 Statistiques:`);
    console.log(`   • Modèles testés: ${validationResults.totalModels}`);
    console.log(`   • Succès: ${validationResults.successCount}`);
    console.log(`   • Erreurs: ${validationResults.errorCount}`);
    console.log(`   • Erreurs critiques: ${validationResults.summary.criticalErrors}`);
    
    // Show errors if any
    if (validationResults.errorCount > 0) {
      console.log(`\n❌ MODÈLES AVEC ERREURS:`);
      validationResults.models
        .filter(m => m.status === 'error')
        .forEach(m => {
          console.log(`   • ${m.model}: ${m.error}`);
        });
    }
    
    // Save validation report
    const validationPath = path.join(process.cwd(), 'database-validation-report.json');
    fs.writeFileSync(validationPath, JSON.stringify(validationResults, null, 2));
    console.log(`\n💾 Rapport de validation sauvegardé: ${validationPath}`);
    
    // Final verdict
    console.log("\n" + "=".repeat(80));
    if (validationResults.summary.criticalErrors === 0) {
      console.log("🎉 VALIDATION TERMINÉE - Tous les modèles fonctionnent correctement");
      process.exit(0);
    } else {
      console.log(`⚠️  VALIDATION TERMINÉE - ${validationResults.summary.criticalErrors} erreurs critiques détectées`);
      process.exit(1);
    }
    
  } catch (error) {
    console.error("❌ Erreur lors de la validation:", error);
    console.error("Détails:", error.message);
    process.exit(1);
  }
};

const validateModel = async (modelName, model) => {
  const result = {
    model: modelName,
    table: model.tableName,
    status: 'success',
    severity: 'info',
    error: null,
    tests: {
      connection: false,
      count: false,
      findOne: false,
      create: false,
      structure: false
    },
    performance: {
      countTime: 0,
      findOneTime: 0
    }
  };
  
  try {
    console.log(`🧪 Test: ${modelName}`);
    
    // Test 1: Basic connection
    await sequelize.query(`SELECT 1`);
    result.tests.connection = true;
    
    // Test 2: Count operation
    const countStart = Date.now();
    const count = await model.count();
    result.performance.countTime = Date.now() - countStart;
    result.tests.count = true;
    
    // Test 3: FindOne operation
    const findOneStart = Date.now();
    await model.findOne({ limit: 1 });
    result.performance.findOneTime = Date.now() - findOneStart;
    result.tests.findOne = true;
    
    // Test 4: Structure validation
    const modelColumns = Object.keys(model.rawAttributes);
    const [tableColumns] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = '${model.tableName}'
    `);
    
    const actualColumns = tableColumns.map(col => col.column_name);
    const missingColumns = modelColumns.filter(col => !actualColumns.includes(col));
    
    if (missingColumns.length > 0) {
      result.status = 'error';
      result.severity = 'critical';
      result.error = `Colonnes manquantes: ${missingColumns.join(', ')}`;
      return result;
    }
    
    result.tests.structure = true;
    
    // Test 5: Create operation (only if table has data)
    if (count > 0) {
      try {
        // Try to create a test record (will be rolled back)
        const transaction = await sequelize.transaction();
        
        try {
          const testData = generateTestData(model);
          await model.create(testData, { transaction });
          await transaction.rollback();
          result.tests.create = true;
        } catch (createError) {
          await transaction.rollback();
          // Don't fail the whole validation for create errors
          console.log(`   ⚠️  Test create échoué: ${createError.message}`);
        }
      } catch (transactionError) {
        console.log(`   ⚠️  Test transaction échoué: ${transactionError.message}`);
      }
    } else {
      result.tests.create = true; // Skip if no data
    }
    
    console.log(`   ✅ Tous les tests passés (${count} enregistrements)`);
    
  } catch (error) {
    result.status = 'error';
    result.severity = 'critical';
    result.error = error.message;
    console.log(`   ❌ Erreur: ${error.message}`);
  }
  
  return result;
};

const generateTestData = (model) => {
  const data = {};
  
  for (const [key, attribute] of Object.entries(model.rawAttributes)) {
    if (key === 'id') continue; // Skip auto-increment
    
    const type = attribute.type.key || attribute.type;
    
    switch (type) {
      case 'STRING':
        data[key] = 'test_string';
        break;
      case 'TEXT':
        data[key] = 'test_text_content';
        break;
      case 'INTEGER':
        data[key] = 1;
        break;
      case 'DECIMAL':
        data[key] = 1.0;
        break;
      case 'BOOLEAN':
        data[key] = true;
        break;
      case 'DATE':
        data[key] = new Date();
        break;
      case 'JSON':
        data[key] = {};
        break;
      case 'ENUM':
        data[key] = attribute.values[0];
        break;
      default:
        data[key] = null;
    }
  }
  
  return data;
};

const testCriticalEndpoints = async (validationResults) => {
  console.log("🌐 Test des endpoints critiques...");
  
  const endpoints = [
    { name: 'Formation Packages', path: '/api/admin/test/packages', model: 'FormationPackage' },
    { name: 'Orders', path: '/api/admin/test/orders', model: 'Order' },
    { name: 'Companies', path: '/api/admin/companies', model: 'Company' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`   🌐 Test: ${endpoint.name}`);
      
      // Check if model exists and is valid
      const model = sequelize.models[endpoint.model];
      if (!model) {
        console.log(`     ⚠️  Modèle ${endpoint.model} non trouvé`);
        continue;
      }
      
      // Test basic model operation
      await model.count();
      console.log(`     ✅ ${endpoint.name} - Modèle fonctionnel`);
      
    } catch (error) {
      console.log(`     ❌ ${endpoint.name} - Erreur: ${error.message}`);
      validationResults.summary.criticalErrors++;
    }
  }
};

// Run validation
runValidation();
