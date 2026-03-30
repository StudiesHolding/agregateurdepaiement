#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const testUpdatedModel = async () => {
  try {
    console.log("🧪 TEST DU MODÈLE MIS À JOUR");
    console.log("=" .repeat(60));
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    // Import the updated model
    console.log("\n🔄 Import du modèle mis à jour...");
    
    // Force reload of the model by clearing the cache and re-importing
    const modelPath = '../models/formation-package.model.js';
    
    // Clear module cache
    delete require.cache[require.resolve(modelPath)];
    
    // Import fresh model
    const { FormationPackage } = await import(modelPath);
    
    console.log(`✅ Modèle importé: ${FormationPackage.tableName}`);
    
    // Test basic operations
    console.log("\n🧪 Test des opérations de base...");
    
    try {
      const count = await FormationPackage.count();
      console.log(`✅ Count: ${count} packages trouvés`);
      
      if (count > 0) {
        const packages = await FormationPackage.findAll({
          limit: 5,
          order: [['price', 'ASC']]
        });
        
        console.log("\n📋 Packages trouvés:");
        packages.forEach((pkg, index) => {
          console.log(`   ${index + 1}. ID: ${pkg.id}`);
          console.log(`      Titre: ${pkg.title}`);
          console.log(`      Prix: ${pkg.price} ${pkg.currency || 'EUR'}`);
          console.log(`      Target: ${pkg.target_audience}`);
          console.log(`      Status: ${pkg.status || 'N/A'}`);
          console.log(`      Actif: ${pkg.is_active}`);
          console.log("");
        });
        
        // Test the exact query from the endpoint
        console.log("🧪 Simulation de l'endpoint /api/admin/test/packages...");
        
        const allPackages = await FormationPackage.findAll({
          order: [['price', 'ASC']],
        });
        
        // Transform to expected format (same as endpoint)
        const formattedPackages = allPackages.map(pkg => ({
          id: String(pkg.id),
          name: pkg.title,
          description: pkg.description || '',
          pricePerLicense: parseFloat(pkg.price) || 0,
          currency: pkg.currency || 'EUR',
          targetAudience: pkg.target_audience,
          status: pkg.status || 'published',
        }));
        
        console.log(`✅ ${formattedPackages.length} packages formatés pour l'API`);
        
        if (formattedPackages.length > 0) {
          console.log("\n📋 Format qui sera envoyé au frontend:");
          formattedPackages.slice(0, 3).forEach((pkg, index) => {
            console.log(`   ${index + 1}. ${JSON.stringify(pkg, null, 4)}`);
          });
        }
        
        // Check B2B compatibility
        const b2bPackages = formattedPackages.filter(pkg => 
          pkg.targetAudience === 'entreprises' || pkg.targetAudience === 'mixed'
        );
        
        const activePackages = formattedPackages.filter(pkg => 
          pkg.is_active !== false && (pkg.status === 'published' || !pkg.status)
        );
        
        console.log(`\n📊 Statistiques:`);
        console.log(`   • Total packages: ${formattedPackages.length}`);
        console.log(`   • Packages B2B: ${b2bPackages.length}`);
        console.log(`   • Packages actifs: ${activePackages.length}`);
        console.log(`   • Packages B2B actifs: ${b2bPackages.filter(p => activePackages.includes(p)).length}`);
        
        if (b2bPackages.filter(p => activePackages.includes(p)).length > 0) {
          console.log("\n🎉 SUCCÈS !");
          console.log("✅ Le modèle fonctionne correctement");
          console.log("✅ Les packages B2B sont disponibles");
          console.log("✅ L'endpoint devrait retourner des données");
          
          console.log("\n🎯 ACTIONS REQUISES:");
          console.log("1. Redémarrez le serveur backend");
          console.log("2. Testez la page B2B");
          console.log("3. Les packages devraient apparaître dans la liste");
          
        } else {
          console.log("\n⚠️  ATTENTION:");
          console.log("• Aucun package B2B actif trouvé");
          console.log("• Vérifiez les valeurs de target_audience et is_active");
        }
        
      } else {
        console.log("❌ Aucun package trouvé dans la table");
      }
      
    } catch (modelError) {
      console.error("❌ Erreur du modèle:", modelError.message);
      console.error("SQL:", modelError.sql);
    }
    
  } catch (error) {
    console.error("❌ Erreur lors du test:", error);
    console.error("Détails:", error.message);
  }
};

// Run test
testUpdatedModel();
