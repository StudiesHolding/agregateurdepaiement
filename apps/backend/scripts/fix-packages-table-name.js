#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const fixPackagesTable = async () => {
  try {
    console.log("🔧 CORRECTION TABLE PACKAGES");
    console.log("=" .repeat(60));
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    // Check both tables
    console.log("\n🔍 Analyse des tables de packages:");
    
    // Check sl_formation_packages
    const [formationPackagesExists] = await sequelize.query(`
      SELECT COUNT(*) as count, COUNT(id) as records FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'sl_formation_packages'
    `);
    
    const [formationPackagesCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM sl_formation_packages
    `);
    
    console.log(`   sl_formation_packages: ${formationPackagesExists[0].count > 0 ? 'EXISTS' : 'MISSING'} - ${formationPackagesCount[0].count} records`);
    
    // Check sl_courses_packages  
    const [coursesPackagesExists] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'sl_courses_packages'
    `);
    
    const [coursesPackagesCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM sl_courses_packages
    `);
    
    console.log(`   sl_courses_packages: ${coursesPackagesExists[0].count > 0 ? 'EXISTS' : 'MISSING'} - ${coursesPackagesCount[0].count} records`);
    
    if (coursesPackagesCount[0].count > 0) {
      console.log("\n📋 Analyse de sl_courses_packages (table avec données):");
      
      // Get structure
      const [columns] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() AND table_name = 'sl_courses_packages'
        ORDER BY ordinal_position
      `);
      
      columns.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
      
      // Get sample data
      const [samples] = await sequelize.query(`
        SELECT * FROM sl_courses_packages LIMIT 3
      `);
      
      if (samples.length > 0) {
        console.log("\n📋 Exemples de données:");
        samples.forEach((row, index) => {
          console.log(`   ${index + 1}. ${JSON.stringify(row, null, 4)}`);
        });
      }
      
      // Check if structure matches FormationPackage model
      console.log("\n🔍 Vérification de compatibilité avec le modèle FormationPackage:");
      
      const requiredColumns = ['id', 'title', 'description', 'price', 'currency', 'target_audience', 'status', 'is_active'];
      const actualColumns = columns.map(col => col.column_name);
      
      const missingColumns = requiredColumns.filter(col => !actualColumns.includes(col));
      const extraColumns = actualColumns.filter(col => !requiredColumns.includes(col));
      
      if (missingColumns.length === 0 && extraColumns.length === 0) {
        console.log("   ✅ Structure compatible avec FormationPackage !");
        
        console.log("\n🔧 SOLUTION: Pointer FormationPackage vers sl_courses_packages");
        
        // Update the model file
        await updateFormationPackageModel();
        
        console.log("✅ Modèle FormationPackage mis à jour !");
        console.log("\n🎯 ACTION REQUISE:");
        console.log("1. Redémarrez le serveur backend");
        console.log("2. Testez la page B2B");
        console.log("3. Les packages devraient maintenant apparaître !");
        
      } else {
        console.log(`   ❌ Structure incompatible:`);
        if (missingColumns.length > 0) {
          console.log(`      Colonnes manquantes: ${missingColumns.join(', ')}`);
        }
        if (extraColumns.length > 0) {
          console.log(`      Colonnes supplémentaires: ${extraColumns.join(', ')}`);
        }
        
        console.log("\n🔧 SOLUTION: Créer une vue ou synchroniser les tables");
        console.log("Option 1: Créer une vue SQL qui mappe sl_courses_packages vers sl_formation_packages");
        console.log("Option 2: Copier les données de sl_courses_packages vers sl_formation_packages");
        console.log("Option 3: Adapter le modèle pour utiliser sl_courses_packages");
        
        // Ask user which option they prefer
        console.log("\n❓ Quelle solution préférez-vous ?");
        console.log("1. Créer une vue SQL (recommandé)");
        console.log("2. Copier les données");
        console.log("3. Adapter le modèle");
      }
    }
    
  } else {
    console.log("\n❌ Aucune table avec des packages trouvée !");
    console.log("💡 Création de packages de test dans sl_formation_packages...");
    await createTestPackages();
  }
    
  } catch (error) {
    console.error("❌ Erreur lors de la correction:", error);
    console.error("Détails:", error.message);
  }
};

const updateFormationPackageModel = async () => {
  const fs = await import('fs');
  const path = await import('path');
  
  const modelPath = path.join(process.cwd(), 'models', 'formation-package.model.js');
  
  let content = fs.readFileSync(modelPath, 'utf8');
  
  // Replace table name
  content = content.replace(
    `tableName: "sl_formation_packages"`,
    `tableName: "sl_courses_packages"`
  );
  
  fs.writeFileSync(modelPath, content);
};

const createTestPackages = async () => {
  console.log("\n🔧 Création de packages de test...");
  
  try {
    // Create test packages with correct enum values
    await sequelize.query(`
      INSERT INTO sl_formation_packages (title, description, price, currency, target_audience, status, is_active, created_at, updated_at) VALUES
      ('Pack B2B - Management', 'Package complet pour les managers', 2999.99, 'EUR', 'entreprises', 'published', 1, NOW(), NOW()),
      ('Pack B2B - Vente', 'Formation pour équipes commerciales', 1999.99, 'EUR', 'entreprises', 'published', 1, NOW(), NOW()),
      ('Pack Mixte - Communication', 'Pour tous publics', 999.99, 'EUR', 'mixed', 'published', 1, NOW(), NOW())
    `);
    
    console.log("✅ 3 packages de test créés !");
    console.log("\n🎯 ACTION REQUISE:");
    console.log("1. Testez la page B2B");
    console.log("2. Les packages devraient maintenant apparaître !");
    
  } catch (error) {
    console.error("❌ Erreur création:", error.message);
    
    // Try with simpler values
    console.log("🔧 Tentative avec valeurs plus simples...");
    try {
      await sequelize.query(`
        INSERT INTO sl_formation_packages (title, price, currency, target_audience, status, is_active, created_at, updated_at) VALUES
        ('Test Pack 1', 100.00, 'EUR', 'entreprises', 'published', 1, NOW(), NOW()),
        ('Test Pack 2', 200.00, 'EUR', 'mixed', 'published', 1, NOW(), NOW())
      `);
      
      console.log("✅ Packages simples créés !");
    } catch (error2) {
      console.error("❌ Erreur création simple:", error2.message);
    }
  }
};

// Run fix
fixPackagesTable();
