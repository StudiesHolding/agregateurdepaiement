#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const syncTablesStructures = async () => {
  try {
    console.log("🔄 SYNCHRONISATION DES STRUCTURES DE TABLES");
    console.log("=" .repeat(70));
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    // Define target structure (from sl_formation_packages)
    const targetStructure = {
      'id': 'INT NOT NULL AUTO_INCREMENT',
      'title': 'VARCHAR(255) NOT NULL',
      'description': 'TEXT NULL',
      'price': 'DECIMAL(15,2) NOT NULL',
      'currency': 'VARCHAR(3) NULL',
      'target_audience': "ENUM('entreprises','particuliers','mixed') NULL",
      'status': "ENUM('draft','published','archived') NULL",
      'formations': 'LONGTEXT NULL',
      'image_url': 'VARCHAR(500) NULL',
      'created_at': 'DATETIME NOT NULL',
      'updated_at': 'DATETIME NOT NULL',
      'is_active': 'TINYINT(1) NOT NULL'
    };
    
    console.log("\n📋 Structure cible (sl_formation_packages):");
    Object.entries(targetStructure).forEach(([col, def]) => {
      console.log(`   ${col}: ${def}`);
    });
    
    // Check current course_packages structure
    console.log("\n🔍 Analyse de course_packages actuelle...");
    
    const [currentColumns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default, extra
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'course_packages'
      ORDER BY ordinal_position
    `);
    
    console.log("\n📋 Structure actuelle (course_packages):");
    currentColumns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    const currentColumnNames = currentColumns.map(col => col.column_name);
    const targetColumnNames = Object.keys(targetStructure);
    
    // Find columns to add, modify, or remove
    const columnsToAdd = targetColumnNames.filter(col => !currentColumnNames.includes(col));
    const columnsToRemove = currentColumnNames.filter(col => !targetColumnNames.includes(col));
    const columnsToCheck = targetColumnNames.filter(col => currentColumnNames.includes(col));
    
    console.log(`\n📊 Analyse des différences:`);
    console.log(`   • Colonnes à ajouter: ${columnsToAdd.length} (${columnsToAdd.join(', ') || 'aucune'})`);
    console.log(`   • Colonnes à supprimer: ${columnsToRemove.length} (${columnsToRemove.join(', ') || 'aucune'})`);
    console.log(`   • Colonnes à vérifier: ${columnsToCheck.length}`);
    
    if (columnsToAdd.length === 0 && columnsToRemove.length === 0) {
      console.log("\n✅ Les structures sont déjà identiques !");
      
      // Just update the model file
      await updateModelFile();
      await testModel();
      return;
    }
    
    // Create backup
    console.log("\n📦 Création du backup...");
    const backupName = `backup_course_packages_${Date.now()}`;
    await sequelize.query(`CREATE TABLE ${backupName} AS SELECT * FROM course_packages`);
    console.log(`   ✅ Backup créé: ${backupName}`);
    
    // Remove unwanted columns
    if (columnsToRemove.length > 0) {
      console.log(`\n🗑️  Suppression des ${columnsToRemove.length} colonnes non désirées...`);
      for (const col of columnsToRemove) {
        try {
          await sequelize.query(`ALTER TABLE course_packages DROP COLUMN ${col}`);
          console.log(`   ✅ ${col} supprimé`);
        } catch (error) {
          console.log(`   ❌ Erreur suppression ${col}: ${error.message}`);
        }
      }
    }
    
    // Add missing columns
    if (columnsToAdd.length > 0) {
      console.log(`\n➕ Ajout des ${columnsToAdd.length} colonnes manquantes...`);
      for (const col of columnsToAdd) {
        try {
          const definition = targetStructure[col];
          await sequelize.query(`ALTER TABLE course_packages ADD COLUMN ${col} ${definition}`);
          console.log(`   ✅ ${col} ajouté (${definition})`);
        } catch (error) {
          console.log(`   ❌ Erreur ajout ${col}: ${error.message}`);
        }
      }
    }
    
    // Update model file
    await updateModelFile();
    
    // Test the updated model
    await testModel();
    
  } catch (error) {
    console.error("❌ Erreur lors de la synchronisation:", error);
    console.error("Détails:", error.message);
  }
};

const updateModelFile = async () => {
  console.log("\n📝 Mise à jour du modèle FormationPackage...");
  
  const modelPath = path.join(process.cwd(), 'models', 'formation-package.model.js');
  
  let content = fs.readFileSync(modelPath, 'utf8');
  
  // Update table name to point to course_packages
  content = content.replace(
    `tableName: "sl_formation_packages"`,
    `tableName: "course_packages"`
  );
  
  // Ensure all fields are correctly mapped
  const modelDefinition = `
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database.js";

export class FormationPackage extends Model {}

FormationPackage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "name",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: "EUR",
    },
    target_audience: {
      type: DataTypes.ENUM("entreprises", "particuliers", "mixed"),
      defaultValue: "entreprises",
      field: "target_audience",
    },
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      defaultValue: "draft",
    },
    formations: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "FormationPackage",
    tableName: "course_packages",
    timestamps: false,
    underscored: true,
  }
);

export default FormationPackage;
`;
  
  fs.writeFileSync(modelPath, modelDefinition);
  console.log("✅ Modèle FormationPackage mis à jour !");
};

const testModel = async () => {
  console.log("\n🧪 Test du modèle mis à jour...");
  
  try {
    // Clear cache and re-import
    delete require.cache[require.resolve('../models/formation-package.model.js')];
    
    const { FormationPackage } = await import("../models/formation-package.model.js");
    
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
      });
      
      // Test B2B filtering
      const b2bPackages = packages.filter(pkg => 
        pkg.target_audience === 'entreprises' || pkg.target_audience === 'mixed'
      );
      
      console.log(`\n📊 ${b2bPackages.length} packages B2B sur ${packages.length} testés`);
      
      if (b2bPackages.length > 0) {
        console.log("\n🎉 SUCCÈS !");
        console.log("✅ Le modèle fonctionne parfaitement");
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

// Run sync
syncTablesStructures();
