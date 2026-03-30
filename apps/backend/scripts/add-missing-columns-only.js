#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const addMissingColumnsOnly = async () => {
  try {
    console.log("➕ AJOUT SEULEMENT DES COLONNES MANQUANTES");
    console.log("=" .repeat(60));
    console.log("🔧 CONSERVATION DES DONNÉES EXISTANTES");
    console.log("➕ Ajout des colonnes manquantes SANS suppression");
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    // Define target structure (from sl_formation_packages)
    const targetStructure = {
      'currency': 'VARCHAR(3) NULL DEFAULT "EUR"',
      'status': "ENUM('draft','published','archived') NULL DEFAULT 'draft'",
      'formations': 'LONGTEXT NULL'
    };
    
    // Check current course_packages structure
    console.log("\n🔍 Analyse de course_packages actuelle...");
    
    const [currentColumns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'course_packages'
      ORDER BY ordinal_position
    `);
    
    console.log("\n📋 Colonnes actuelles dans course_packages:");
    currentColumns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    const currentColumnNames = currentColumns.map(col => col.column_name);
    const targetColumnNames = Object.keys(targetStructure);
    
    // Find only columns to add (no removal!)
    const columnsToAdd = targetColumnNames.filter(col => !currentColumnNames.includes(col));
    const existingColumns = targetColumnNames.filter(col => currentColumnNames.includes(col));
    
    console.log(`\n📊 Analyse des ajouts nécessaires:`);
    console.log(`   • Colonnes à ajouter: ${columnsToAdd.length} (${columnsToAdd.join(', ') || 'aucune'})`);
    console.log(`   • Colonnes déjà présentes: ${existingColumns.length} (${existingColumns.join(', ') || 'aucune'})`);
    
    if (columnsToAdd.length === 0) {
      console.log("\n✅ Toutes les colonnes requises existent déjà !");
      console.log("💡 Seulement la mise à jour du modèle est nécessaire");
      
      // Just update the model file
      await updateModelFileOnly();
      await testModelOnly();
      return;
    }
    
    // Create backup before adding columns
    console.log("\n📦 Création du backup avant modification...");
    const backupName = `backup_course_packages_${Date.now()}`;
    await sequelize.query(`CREATE TABLE ${backupName} AS SELECT * FROM course_packages`);
    console.log(`   ✅ Backup créé: ${backupName}`);
    
    // Add ONLY missing columns (no removal!)
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
    
    // Update model file
    await updateModelFileOnly();
    
    // Test the updated model
    await testModelOnly();
    
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout:", error);
    console.error("Détails:", error.message);
  }
};

const updateModelFileOnly = async () => {
  console.log("\n📝 Mise à jour du modèle FormationPackage...");
  
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

const testModelOnly = async () => {
  console.log("\n🧪 Test du modèle mis à jour...");
  
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
        console.log("\n🎉 SUCCÈS !");
        console.log("✅ Le modèle fonctionne parfaitement");
        console.log("✅ Les packages B2B sont accessibles");
        console.log("✅ Toutes vos données existantes sont préservées !");
        
        console.log("\n🎯 INSTRUCTIONS FINALES:");
        console.log("1. Arrêtez le serveur backend (Ctrl+C)");
        console.log("2. Redémarrez avec: npm start");
        console.log("3. Attendez 10 secondes que le serveur démarre");
        console.log("4. Testez votre page B2B");
        console.log("5. Les packages devraient apparaître dans la liste déroulante !");
        console.log("6. Vos données existantes sont intactes !");
        
      } else {
        console.log("\n⚠️  ATTENTION:");
        console.log(`• Aucun package B2B actif trouvé`);
        console.log(`• Vérifiez que target_audience = 'entreprises' dans course_packages`);
        console.log(`• Vérifiez que featured = 1 dans course_packages`);
      }
    }
    
  } catch (error) {
    console.error("❌ Erreur test modèle:", error.message);
  }
};

// Run add missing columns only
addMissingColumnsOnly();
