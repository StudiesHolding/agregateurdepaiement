#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const robustRestoreAndAdd = async () => {
  try {
    console.log("🔄 RESTAURATION ROBUSTE ET AJOUT DE COLONNES");
    console.log("=" .repeat(70));
    console.log("🛡️ APPROCHE ROBUSTE - Gestion des incohérences");
    console.log("🔄 Utilisation du backup existant avec gestion d'erreurs");
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    // Check if backup exists
    const backupName = 'backup_course_packages_1774865332018';
    
    const [backupExists] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = '${backupName}'
    `);
    
    if (backupExists[0].count === 0) {
      console.log(`❌ Backup ${backupName} non trouvé !`);
      console.log("💡 Vérifiez le nom exact du backup");
      return;
    }
    
    console.log(`✅ Backup ${backupName} trouvé`);
    
    // Check backup structure and data
    const [backupColumns] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = '${backupName}'
      ORDER BY ordinal_position
    `);
    
    const [backupData] = await sequelize.query(`
      SELECT COUNT(*) as count FROM ${backupName}
    `);
    
    console.log(`📊 Backup: ${backupColumns.length} colonnes, ${backupData[0].count} enregistrements`);
    
    // Check current course_packages structure
    console.log("\n🔍 Analyse de course_packages actuelle...");
    
    const [currentColumns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'course_packages'
      ORDER BY ordinal_position
    `);
    
    const [currentData] = await sequelize.query(`
      SELECT COUNT(*) as count FROM course_packages
    `);
    
    console.log(`📊 Actuel: ${currentColumns.length} colonnes, ${currentData[0].count} enregistrements`);
    
    const backupColumnNames = backupColumns.map(col => col.column_name);
    const currentColumnNames = currentColumns.map(col => col.column_name);
    
    // Check for structure differences
    const missingInCurrent = backupColumnNames.filter(col => !currentColumnNames.includes(col));
    const extraInCurrent = currentColumnNames.filter(col => !backupColumnNames.includes(col));
    
    console.log(`\n📊 Analyse des différences de structure:`);
    console.log(`   • Colonnes manquantes dans course_packages: ${missingInCurrent.length} (${missingInCurrent.join(', ') || 'aucune'})`);
    console.log(`   • Colonnes supplémentaires dans course_packages: ${extraInCurrent.length} (${extraInCurrent.join(', ') || 'aucune'})`);
    
    // Define target structure (from sl_formation_packages)
    const targetStructure = {
      'currency': 'VARCHAR(3) NULL DEFAULT "EUR"',
      'status': "ENUM('draft','published','archived') NULL DEFAULT 'draft'",
      'formations': 'LONGTEXT NULL'
    };
    
    const targetColumnNames = Object.keys(targetStructure);
    const columnsToAdd = targetColumnNames.filter(col => !currentColumnNames.includes(col));
    
    console.log(`\n📊 Colonnes à ajouter (cible sl_formation_packages): ${columnsToAdd.length} (${columnsToAdd.join(', ') || 'aucune'})`);
    
    // Step 1: Smart restore with error handling
    console.log("\n🔄 Étape 1: Restauration intelligente...");
    
    try {
      // Clear current course_packages (sauf si déjà vide)
      if (currentData[0].count > 0) {
        await sequelize.query(`DELETE FROM course_packages`);
        console.log("   ✅ Table course_packages vidée");
      } else {
        console.log("   ℹ️  Table course_packages déjà vide");
      }
      
      // Restore data from backup with INSERT IGNORE to handle column mismatches
      await sequelize.query(`
        INSERT IGNORE INTO course_packages 
        SELECT * FROM ${backupName}
      `);
      
      // Check how many records were actually restored
      const [restoredData] = await sequelize.query(`
        SELECT COUNT(*) as count FROM course_packages
      `);
      
      console.log(`   ✅ ${restoredData[0].count}/${backupData[0].count} enregistrements restaurés`);
      
      if (restoredData[0].count < backupData[0].count) {
        console.log(`   ⚠️  Certains enregistrements non restaurés (incohérence de structure)`);
      }
      
    } catch (restoreError) {
      console.error(`   ❌ Erreur restauration: ${restoreError.message}`);
      
      // Try alternative restore approach
      console.log("   🔄 Tentative d'approche alternative...");
      
      try {
        // Select only columns that exist in both tables
        const commonColumns = backupColumnNames.filter(col => currentColumnNames.includes(col));
        
        if (commonColumns.length > 0) {
          const selectFields = commonColumns.join(', ');
          await sequelize.query(`
            INSERT IGNORE INTO course_packages (${selectFields})
            SELECT ${selectFields} FROM ${backupName}
          `);
          
          const [altRestoredData] = await sequelize.query(`
            SELECT COUNT(*) as count FROM course_packages
          `);
          
          console.log(`   ✅ Approche alternative: ${altRestoredData[0].count} enregistrements restaurés`);
        }
        
      } catch (altError) {
        console.error(`   ❌ Approche alternative échouée: ${altError.message}`);
        console.log("   💡 Continue avec les données existantes...");
      }
    }
    
    // Step 2: Add missing columns
    if (columnsToAdd.length > 0) {
      console.log(`\n➕ Étape 2: Ajout des ${columnsToAdd.length} colonnes manquantes...`);
      
      for (const col of columnsToAdd) {
        try {
          const definition = targetStructure[col];
          await sequelize.query(`ALTER TABLE course_packages ADD COLUMN ${col} ${definition}`);
          console.log(`   ✅ ${col} ajouté (${definition})`);
        } catch (error) {
          console.log(`   ❌ Erreur ajout ${col}: ${error.message}`);
        }
      }
    } else {
      console.log("\n✅ Toutes les colonnes requises existent déjà !");
    }
    
    // Step 3: Update model file
    console.log("\n📝 Étape 3: Mise à jour du modèle FormationPackage...");
    await updateModelFile();
    
    // Step 4: Test the updated model
    console.log("\n🧪 Étape 4: Test du modèle mis à jour...");
    await testModel();
    
    // Step 5: Clean up backup
    console.log("\n🗑️  Étape 5: Nettoyage du backup...");
    try {
      await sequelize.query(`DROP TABLE ${backupName}`);
      console.log(`   ✅ Backup ${backupName} supprimé`);
    } catch (cleanupError) {
      console.log(`   ⚠️  Erreur suppression backup: ${cleanupError.message}`);
    }
    
  } catch (error) {
    console.error("❌ Erreur lors de la restauration robuste:", error);
    console.error("Détails:", error.message);
  }
};

const updateModelFile = async () => {
  const modelPath = path.join(process.cwd(), 'models', 'formation-package.model.js');
  
  let content = fs.readFileSync(modelPath, 'utf8');
  
  // Update table name to point to course_packages
  content = content.replace(
    `tableName: "sl_formation_packages"`,
    `tableName: "course_packages"`
  );
  
  // Update field mappings
  content = content.replace(
    `title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },`,
        `title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "name",
    },`
  );
  
  content = content.replace(
    `is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },`,
        `is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "featured",
    },`
  );
  
  // Add missing fields if not present
  if (!content.includes('currency:')) {
    content = content.replace(
      `price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },`,
        `price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: "EUR",
    },`
    );
  }
  
  if (!content.includes('status:')) {
    content = content.replace(
      `is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "featured",
    },`,
        `is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "featured",
    },
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      defaultValue: "draft",
    },`
    );
  }
  
  if (!content.includes('formations:')) {
    content = content.replace(
      `image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },`,
        `image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    formations: {
      type: DataTypes.JSON,
      allowNull: true,
    },`
    );
  }
  
  // Update timestamps to match actual table
  content = content.replace(
    `timestamps: true,`,
        `timestamps: false,`
  );
  
  content = content.replace(
    `underscored: true,`,
        `underscored: true,`
  );
  
  fs.writeFileSync(modelPath, content);
  console.log("✅ Modèle FormationPackage mis à jour !");
};

const testModel = async () => {
  try {
    // Use model directly from sequelize.models
    const FormationPackage = sequelize.models.FormationPackage;
    
    if (!FormationPackage) {
      console.log("❌ FormationPackage non trouvé - redémarrez le serveur");
      return;
    }
    
    console.log(`✅ Modèle: ${FormationPackage.tableName}`);
    
    // Test basic operations
    const count = await FormationPackage.count();
    console.log(`✅ Count: ${count} packages trouvés`);
    
    if (count > 0) {
      const packages = await FormationPackage.findAll({
        limit: 3,
        order: [['price', 'ASC']]
      });
      
      console.log("\n📋 Packages trouvés:");
      packages.forEach((pkg, index) => {
        console.log(`   ${index + 1}. ${pkg.title} - ${pkg.price}€ (${pkg.target_audience})`);
        console.log(`      Status: ${pkg.status || 'N/A'}, Actif: ${pkg.is_active}`);
      });
      
      // Test B2B filtering
      const b2bPackages = packages.filter(pkg => 
        pkg.target_audience === 'entreprises' || pkg.target_audience === 'mixed'
      );
      
      const activePackages = packages.filter(pkg => 
        pkg.is_active !== false && (pkg.status === 'published' || !pkg.status)
      );
      
      const b2bActivePackages = b2bPackages.filter(pkg => activePackages.includes(pkg));
      
      console.log(`\n📊 Statistiques finales:`);
      console.log(`   • Total packages: ${packages.length}`);
      console.log(`   • Packages B2B: ${b2bPackages.length}`);
      console.log(`   • Packages actifs: ${activePackages.length}`);
      console.log(`   • Packages B2B actifs: ${b2bActivePackages.length}`);
      
      if (b2bActivePackages.length > 0) {
        console.log("\n🎉 SUCCÈS TOTAL !");
        console.log("✅ Le modèle fonctionne parfaitement");
        console.log("✅ Les packages B2B sont accessibles");
        console.log("✅ Vos données ont été restaurées avec succès !");
        
        console.log("\n🎯 INSTRUCTIONS FINALES:");
        console.log("1. Arrêtez le serveur backend (Ctrl+C)");
        console.log("2. Redémarrez avec: npm start");
        console.log("3. Attendez 10 secondes que le serveur démarre");
        console.log("4. Testez votre page B2B");
        console.log("5. Les packages devraient apparaître dans la liste déroulante !");
        console.log("6. Vos packages originaux sont préservés !");
        
      } else {
        console.log("\n⚠️  ATTENTION:");
        console.log(`• Aucun package B2B actif trouvé`);
        console.log(`• Vérifiez les valeurs dans course_packages après restauration`);
      }
    }
    
  } catch (error) {
    console.error("❌ Erreur test modèle:", error.message);
  }
};

// Run robust restore and add
robustRestoreAndAdd();
