#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const fixOrdersTable = async () => {
  try {
    console.log("🔧 CORRECTION DE LA TABLE ORDERS");
    console.log("=" .repeat(60));
    console.log("🔍 Problème: Field 'totalAmount' doesn't have a default value");
    console.log("🔧 Solution: Ajouter les colonnes manquantes dans orders");
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    // Check orders table structure
    console.log("\n🔍 Analyse de la table orders...");
    
    const [ordersColumns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'orders'
      ORDER BY ordinal_position
    `);
    
    console.log("\n📋 Colonnes actuelles dans orders:");
    ordersColumns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    
    const currentColumnNames = ordersColumns.map(col => col.column_name);
    
    // Define required columns based on Order model
    const requiredColumns = {
      'total_amount': {
        definition: 'DECIMAL(15,2) NOT NULL DEFAULT 0.00',
        modelField: 'totalAmount'
      },
      'customer_email': {
        definition: 'VARCHAR(255) NOT NULL',
        modelField: 'customerEmail'
      },
      'customer_name': {
        definition: 'VARCHAR(255) NULL',
        modelField: 'customerName'
      },
      'customer_surname': {
        definition: 'VARCHAR(255) NULL',
        modelField: 'customerSurname'
      },
      'customer_phone': {
        definition: 'VARCHAR(50) NULL',
        modelField: 'customerPhone'
      },
      'customer_city': {
        definition: 'VARCHAR(100) NULL',
        modelField: 'customerCity'
      },
      'customer_country': {
        definition: 'VARCHAR(100) NULL',
        modelField: 'customerCountry'
      },
      'currency': {
        definition: 'VARCHAR(10) NOT NULL DEFAULT "XAF"',
        modelField: 'currency'
      },
      'status': {
        definition: 'VARCHAR(50) NOT NULL DEFAULT "pending"',
        modelField: 'status'
      },
      'formation_id': {
        definition: 'BIGINT NULL',
        modelField: 'formationId'
      },
      'formation_name': {
        definition: 'VARCHAR(255) NULL',
        modelField: 'formationName'
      },
      'company_name': {
        definition: 'VARCHAR(255) NULL',
        modelField: 'companyName'
      },
      'company_admin_email': {
        definition: 'VARCHAR(255) NULL',
        modelField: 'companyAdminEmail'
      },
      'licence_count': {
        definition: 'INT NULL DEFAULT 1',
        modelField: 'licenceCount'
      },
      'unit_price': {
        definition: 'DECIMAL(15,2) NULL DEFAULT 0.00',
        modelField: 'unitPrice'
      }
    };
    
    // Find missing columns
    const missingColumns = Object.entries(requiredColumns).filter(([colName, info]) => !currentColumnNames.includes(colName));
    
    console.log(`\n📊 Analyse des colonnes manquantes:`);
    console.log(`   • Colonnes requises: ${Object.keys(requiredColumns).length}`);
    console.log(`   • Colonnes existantes: ${currentColumnNames.length}`);
    console.log(`   • Colonnes manquantes: ${missingColumns.length}`);
    
    if (missingColumns.length > 0) {
      console.log(`\n📋 Colonnes manquantes détaillées:`);
      missingColumns.forEach(([colName, info]) => {
        console.log(`   • ${colName} (${info.modelField}): ${info.definition}`);
      });
      
      // Create backup
      console.log("\n📦 Création du backup avant modification...");
      const backupName = `backup_orders_${Date.now()}`;
      await sequelize.query(`CREATE TABLE ${backupName} AS SELECT * FROM orders`);
      console.log(`   ✅ Backup créé: ${backupName}`);
      
      // Add missing columns
      console.log(`\n➕ Ajout des ${missingColumns.length} colonnes manquantes...`);
      
      for (const [colName, info] of missingColumns) {
        try {
          await sequelize.query(`ALTER TABLE orders ADD COLUMN ${colName} ${info.definition}`);
          console.log(`   ✅ ${colName} ajouté (${info.modelField})`);
        } catch (error) {
          console.log(`   ❌ Erreur ajout ${colName}: ${error.message}`);
        }
      }
      
    } else {
      console.log("\n✅ Toutes les colonnes requises existent déjà !");
    }
    
    // Test the Order model
    console.log("\n🧪 Test du modèle Order...");
    await testOrderModel();
    
  } catch (error) {
    console.error("❌ Erreur lors de la correction:", error);
    console.error("Détails:", error.message);
  }
};

const testOrderModel = async () => {
  try {
    const Order = sequelize.models.Order;
    
    if (!Order) {
      console.log("❌ Order non trouvé dans sequelize.models");
      return;
    }
    
    console.log(`✅ Modèle Order trouvé: ${Order.tableName}`);
    
    // Test basic operations
    const count = await Order.count();
    console.log(`✅ Orders existants: ${count}`);
    
    // Test creating a simple order
    console.log("\n🧪 Test de création d'une commande B2B...");
    
    try {
      const testOrder = await Order.create({
        reference: `TEST-${Date.now()}`,
        customerEmail: 'test@company.com',
        customerName: 'Test Company',
        currency: 'XAF',
        totalAmount: 50000,
        status: 'pending',
        formationId: 1,
        formationName: 'Test Package',
        companyName: 'Test Company',
        companyAdminEmail: 'admin@test.com',
        licenceCount: 1,
        unitPrice: 50000
      });
      
      console.log(`✅ Commande test créée: ID ${testOrder.id}`);
      
      // Clean up test order
      await testOrder.destroy();
      console.log("   ✅ Commande test supprimée");
      
      console.log("\n🎉 SUCCÈS !");
      console.log("✅ Le modèle Order fonctionne correctement");
      console.log("✅ Les commandes B2B peuvent être créées");
      
      console.log("\n🎯 INSTRUCTIONS FINALES:");
      console.log("1. Redémarrez le serveur backend (Ctrl+C)");
      console.log("2. Retestez votre page B2B");
      console.log("3. Les commandes B2B devraient maintenant se créer sans erreur !");
      
    } catch (createError) {
      console.error("❌ Erreur création commande test:", createError.message);
      console.error("SQL:", createError.sql);
      
      // Try to identify the specific missing field
      if (createError.message.includes("doesn't have a default value")) {
        console.log("\n💡 Analyse de l'erreur de default value...");
        
        // Check which field is causing the issue
        const [ordersColumns] = await sequelize.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = DATABASE() AND table_name = 'orders'
          AND is_nullable = 'NO' AND column_default IS NULL
        `);
        
        if (ordersColumns.length > 0) {
          console.log("📋 Colonnes NOT NULL sans default value:");
          ordersColumns.forEach(col => {
            console.log(`   • ${col.column_name}: ${col.data_type}`);
          });
          
          console.log("\n🔧 Correction automatique des default values...");
          
          for (const col of ordersColumns) {
            try {
              let defaultValue = 'DEFAULT ""';
              if (col.data_type.includes('DECIMAL') || col.data_type.includes('INT')) {
                defaultValue = 'DEFAULT 0';
              } else if (col.data_type.includes('VARCHAR')) {
                defaultValue = 'DEFAULT ""';
              }
              
              await sequelize.query(`ALTER TABLE orders ALTER COLUMN ${col.column_name} SET ${defaultValue}`);
              console.log(`   ✅ ${col.column_name} default value ajouté`);
            } catch (fixError) {
              console.log(`   ❌ Erreur fix ${col.column_name}: ${fixError.message}`);
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error("❌ Erreur test modèle Order:", error.message);
  }
};

// Run fix
fixOrdersTable();
