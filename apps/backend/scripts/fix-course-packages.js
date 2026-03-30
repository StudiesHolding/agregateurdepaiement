#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const fixCoursePackages = async () => {
  try {
    console.log("🔧 CORRECTION VERS COURSE_PACKAGES");
    console.log("=" .repeat(60));
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    // Check course_packages table
    console.log("\n🔍 Analyse de la table course_packages:");
    
    const [tableExists] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = 'course_packages'
    `);
    
    if (tableExists[0].count === 0) {
      console.log("❌ Table course_packages n'existe pas !");
      return;
    }
    
    console.log("✅ Table course_packages existe");
    
    // Get structure
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'course_packages'
      ORDER BY ordinal_position
    `);
    
    console.log("\n📋 Structure de course_packages:");
    columns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Get sample data
    const [samples] = await sequelize.query(`
      SELECT * FROM course_packages LIMIT 3
    `);
    
    console.log("\n📋 Exemples de données:");
    samples.forEach((row, index) => {
      console.log(`   ${index + 1}. ID: ${row.id}, Nom: ${row.name}, Prix: ${row.price}, Target: ${row.target_audience}`);
    });
    
    // Check compatibility with FormationPackage model
    console.log("\n🔍 Vérification de compatibilité:");
    
    const actualColumns = columns.map(col => col.column_name);
    const requiredMapping = {
      'id': 'id',
      'title': 'name', // Map name -> title
      'description': 'description',
      'price': 'price',
      'currency': 'currency', // Will default to EUR
      'target_audience': 'target_audience',
      'status': 'status', // Will default to published
      'is_active': 'featured', // Map featured -> is_active
      'image_url': 'image_url'
    };
    
    console.log("📋 Mapping colonnes:");
    Object.entries(requiredMapping).forEach(([modelField, tableField]) => {
      const exists = actualColumns.includes(tableField);
      console.log(`   ${modelField} <- ${tableField}: ${exists ? '✅' : '❌'}`);
    });
    
    // Update the model to use course_packages
    console.log("\n🔧 MISE À JOUR DU MODÈLE:");
    
    const modelPath = path.join(process.cwd(), 'models', 'formation-package.model.js');
    
    let content = fs.readFileSync(modelPath, 'utf8');
    
    // Update table name
    content = content.replace(
      `tableName: "sl_formation_packages"`,
      `tableName: "course_packages"`
    );
    
    // Update field mappings
    content = content.replace(
      `field: "target_audience",`,
      `field: "target_audience",`
    );
    
    // Add field mappings for the incompatible fields
    if (!content.includes('field: "name"')) {
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
    }
    
    if (!content.includes('field: "featured"')) {
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
    }
    
    // Add status field with default
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
    
    // Add currency field with default
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
    
    // Remove timestamps if they don't exist in the table
    const hasCreatedAt = actualColumns.includes('created_at');
    const hasUpdatedAt = actualColumns.includes('updated_at');
    
    if (!hasCreatedAt || !hasUpdatedAt) {
      content = content.replace(
        `timestamps: true,`,
        `timestamps: ${hasCreatedAt && hasUpdatedAt},`
      );
    }
    
    fs.writeFileSync(modelPath, content);
    console.log("✅ Modèle FormationPackage mis à jour !");
    
    // Test the updated model
    console.log("\n🧪 Test du modèle mis à jour:");
    
    try {
      // Clear the require cache to reload the model
      delete require.cache[require.resolve('../models/formation-package.model.js')];
      
      const { FormationPackage } = await import("../models/formation-package.model.js");
      
      const count = await FormationPackage.count();
      console.log(`✅ ${count} packages trouvés dans course_packages`);
      
      if (count > 0) {
        const packages = await FormationPackage.findAll({ limit: 3 });
        console.log("\n📋 Packages formatés:");
        packages.forEach((pkg, index) => {
          console.log(`   ${index + 1}. ${pkg.title} - ${pkg.price}€ (${pkg.target_audience})`);
        });
      }
      
    } catch (error) {
      console.error("❌ Erreur test modèle:", error.message);
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("🎉 CORRECTION TERMINÉE !");
    console.log("=".repeat(60));
    console.log("🎯 ACTIONS REQUISES:");
    console.log("1. Redémarrez le serveur backend");
    console.log("2. Testez la page B2B");
    console.log("3. Les packages devraient maintenant apparaître !");
    
  } catch (error) {
    console.error("❌ Erreur lors de la correction:", error);
    console.error("Détails:", error.message);
  }
};

// Run fix
fixCoursePackages();
