#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const fixCoursePackagesClean = async () => {
  try {
    console.log("🔧 CORRECTION PROPRE DE COURSE_PACKAGES");
    console.log("=" .repeat(60));
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    // Check course_packages table structure
    console.log("\n🔍 Analyse de la table course_packages:");
    
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'course_packages'
      ORDER BY ordinal_position
    `);
    
    console.log("\n📋 Colonnes existantes dans course_packages:");
    columns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    const actualColumns = columns.map(col => col.column_name);
    
    // Define what the FormationPackage model needs
    const requiredColumns = {
      'id': { exists: actualColumns.includes('id'), sql: 'id INT NOT NULL AUTO_INCREMENT' },
      'title': { exists: actualColumns.includes('name'), sql: 'title VARCHAR(255) NOT NULL' }, // Map name -> title
      'description': { exists: actualColumns.includes('description'), sql: 'description TEXT NULL' },
      'price': { exists: actualColumns.includes('price'), sql: 'price DECIMAL(15,2) NOT NULL' },
      'currency': { exists: actualColumns.includes('currency'), sql: 'currency VARCHAR(3) DEFAULT "EUR"' },
      'target_audience': { exists: actualColumns.includes('target_audience'), sql: 'target_audience ENUM("entreprises","particuliers","mixed") NOT NULL' },
      'status': { exists: actualColumns.includes('status'), sql: 'status ENUM("draft","published","archived") DEFAULT "published"' },
      'is_active': { exists: actualColumns.includes('featured'), sql: 'is_active BOOLEAN DEFAULT 1' }, // Map featured -> is_active
      'image_url': { exists: actualColumns.includes('image_url'), sql: 'image_url VARCHAR(500) NULL' },
      'created_at': { exists: actualColumns.includes('created_at'), sql: 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
      'updated_at': { exists: actualColumns.includes('updated_at'), sql: 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
    };
    
    console.log("\n🔍 Vérification des colonnes requises:");
    Object.entries(requiredColumns).forEach(([fieldName, info]) => {
      console.log(`   ${fieldName}: ${info.exists ? '✅' : '❌'}`);
    });
    
    // Add missing columns
    const missingColumns = Object.entries(requiredColumns).filter(([fieldName, info]) => !info.exists);
    
    if (missingColumns.length === 0) {
      console.log("\n✅ Toutes les colonnes requises existent déjà !");
      
      // Just update the model file
      await updateModelFile();
      
    } else {
      console.log(`\n🔧 Ajout des ${missingColumns.length} colonnes manquantes:`);
      
      // Create backup
      const backupName = `backup_course_packages_${Date.now()}`;
      await sequelize.query(`CREATE TABLE ${backupName} AS SELECT * FROM course_packages`);
      console.log(`   📦 Backup créé: ${backupName}`);
      
      // Add missing columns
      for (const [fieldName, info] of missingColumns) {
        try {
          console.log(`   🔧 Ajout: ${fieldName}`);
          await sequelize.query(`ALTER TABLE course_packages ADD COLUMN ${info.sql}`);
          console.log(`   ✅ ${fieldName} ajouté`);
        } catch (error) {
          console.log(`   ❌ Erreur ajout ${fieldName}: ${error.message}`);
        }
      }
      
      // Update the model file
      await updateModelFile();
    }
    
    // Test the updated model
    console.log("\n🧪 Test du modèle mis à jour...");
    await testUpdatedModel();
    
  } catch (error) {
    console.error("❌ Erreur lors de la correction:", error);
    console.error("Détails:", error.message);
  }
};

const updateModelFile = async () => {
  console.log("\n📝 Mise à jour du fichier modèle...");
  
  const modelPath = path.join(process.cwd(), 'models', 'formation-package.model.js');
  
  let content = fs.readFileSync(modelPath, 'utf8');
  
  // Update table name
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
  
  // Add currency field if not present
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
  
  // Add status field if not present
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
      defaultValue: "published",
    },`
    );
  }
  
  // Update timestamps if needed
  const hasCreatedAt = content.includes('created_at');
  const hasUpdatedAt = content.includes('updated_at');
  
  if (!hasCreatedAt || !hasUpdatedAt) {
    content = content.replace(
      `timestamps: true,`,
        `timestamps: true,`
    );
  }
  
  fs.writeFileSync(modelPath, content);
  console.log("✅ Fichier modèle mis à jour !");
};

const testUpdatedModel = async () => {
  try {
    // Use the model from sequelize.models (already loaded)
    const FormationPackage = sequelize.models.FormationPackage;
    
    if (!FormationPackage) {
      console.log("❌ FormationPackage non trouvé - redémarrez le serveur");
      return;
    }
    
    console.log(`✅ Modèle: ${FormationPackage.tableName}`);
    
    // Test basic operations
    const count = await FormationPackage.count();
    console.log(`✅ Count: ${count} packages`);
    
    if (count > 0) {
      const packages = await FormationPackage.findAll({
        limit: 3,
        order: [['price', 'ASC']]
      });
      
      console.log("\n📋 Packages trouvés:");
      packages.forEach((pkg, index) => {
        console.log(`   ${index + 1}. ${pkg.title} - ${pkg.price}€ (${pkg.target_audience})`);
      });
      
      // Test B2B filtering
      const b2bPackages = packages.filter(pkg => 
        pkg.target_audience === 'entreprises' || pkg.target_audience === 'mixed'
      );
      
      console.log(`\n📊 ${b2bPackages.length} packages B2B sur ${packages.length} testés`);
      
      if (b2bPackages.length > 0) {
        console.log("\n🎉 SUCCÈS !");
        console.log("✅ Le modèle fonctionne correctement");
        console.log("✅ Les packages B2B sont accessibles");
        
        console.log("\n🎯 INSTRUCTIONS FINALES:");
        console.log("1. Arrêtez le serveur backend (Ctrl+C)");
        console.log("2. Redémarrez avec: npm start");
        console.log("3. Testez votre page B2B");
        console.log("4. Les packages devraient apparaître dans la liste !");
        
      } else {
        console.log("\n⚠️  Aucun package B2B trouvé dans l'échantillon");
      }
    }
    
  } catch (error) {
    console.error("❌ Erreur test modèle:", error.message);
  }
};

// Run clean fix
fixCoursePackagesClean();
