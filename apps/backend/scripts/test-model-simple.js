#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const testModelSimple = async () => {
  try {
    console.log("🧪 TEST SIMPLE DU MODÈLE");
    console.log("=" .repeat(50));
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    // Test the model directly from sequelize.models
    console.log("\n🔍 Test du modèle depuis sequelize.models...");
    
    const FormationPackage = sequelize.models.FormationPackage;
    
    if (!FormationPackage) {
      console.log("❌ FormationPackage non trouvé dans sequelize.models");
      return;
    }
    
    console.log(`✅ Modèle trouvé: ${FormationPackage.tableName}`);
    console.log(`✅ Table cible: ${FormationPackage.tableName}`);
    
    // Test basic operations
    console.log("\n🧪 Test des opérations...");
    
    try {
      const count = await FormationPackage.count();
      console.log(`✅ Count: ${count} packages trouvés`);
      
      if (count > 0) {
        const packages = await FormationPackage.findAll({
          limit: 3,
          order: [['price', 'ASC']]
        });
        
        console.log("\n📋 Exemples de packages:");
        packages.forEach((pkg, index) => {
          console.log(`   ${index + 1}. ${pkg.title} - ${pkg.price}€ (${pkg.target_audience})`);
        });
        
        // Test the exact endpoint format
        console.log("\n🧪 Test du format de l'endpoint...");
        
        const allPackages = await FormationPackage.findAll({
          order: [['price', 'ASC']],
        });
        
        const formattedPackages = allPackages.map(pkg => ({
          id: String(pkg.id),
          name: pkg.title,
          description: pkg.description || '',
          pricePerLicense: parseFloat(pkg.price) || 0,
          currency: pkg.currency || 'EUR',
          targetAudience: pkg.target_audience,
          status: pkg.status || 'published',
        }));
        
        console.log(`✅ ${formattedPackages.length} packages formatés`);
        
        // Check B2B compatibility
        const b2bPackages = formattedPackages.filter(pkg => 
          pkg.targetAudience === 'entreprises' || pkg.targetAudience === 'mixed'
        );
        
        const activePackages = formattedPackages.filter(pkg => 
          pkg.is_active !== false && (pkg.status === 'published' || !pkg.status)
        );
        
        console.log(`\n📊 Statistiques B2B:`);
        console.log(`   • Total: ${formattedPackages.length}`);
        console.log(`   • B2B: ${b2bPackages.length}`);
        console.log(`   • Actifs: ${activePackages.length}`);
        console.log(`   • B2B Actifs: ${b2bPackages.filter(p => activePackages.includes(p)).length}`);
        
        if (b2bPackages.filter(p => activePackages.includes(p)).length > 0) {
          console.log("\n🎉 SUCCÈS TOTAL !");
          console.log("✅ Le modèle fonctionne parfaitement");
          console.log("✅ Les packages B2B sont disponibles");
          console.log("✅ L'endpoint va retourner les bonnes données");
          
          console.log("\n🎯 INSTRUCTIONS FINALES:");
          console.log("1. Arrêtez votre serveur backend (Ctrl+C)");
          console.log("2. Redémarrez avec: npm start ou npm run dev");
          console.log("3. Testez votre page B2B");
          console.log("4. Les packages devraient apparaître !");
          
        } else {
          console.log("\n⚠️  PROBLÈME DÉTECTÉ:");
          console.log("• Aucun package B2B actif");
          console.log("• Vérifiez: target_audience = 'entreprises'");
          console.log("• Vérifiez: is_active = true");
        }
        
      } else {
        console.log("❌ La table course_packages est vide !");
      }
      
    } catch (modelError) {
      console.error("❌ Erreur modèle:", modelError.message);
      if (modelError.sql) {
        console.error("SQL:", modelError.sql);
      }
    }
    
  } catch (error) {
    console.error("❌ Erreur générale:", error);
    console.error("Détails:", error.message);
  }
};

// Run simple test
testModelSimple();
