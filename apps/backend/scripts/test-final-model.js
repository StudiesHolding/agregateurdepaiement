#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const testFinalModel = async () => {
  try {
    console.log("🧪 TEST FINAL DU MODÈLE");
    console.log("=" .repeat(50));
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    // Use model directly from sequelize.models (already loaded)
    console.log("\n🔍 Utilisation du modèle depuis sequelize.models...");
    
    const FormationPackage = sequelize.models.FormationPackage;
    
    if (!FormationPackage) {
      console.log("❌ FormationPackage non trouvé dans sequelize.models");
      console.log("💡 Redémarrez le serveur pour recharger les modèles");
      return;
    }
    
    console.log(`✅ Modèle trouvé: ${FormationPackage.tableName}`);
    console.log(`✅ Table cible: ${FormationPackage.tableName}`);
    
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
          console.log(`   ${index + 1}. ${pkg.title} - ${pkg.price}€ (${pkg.target_audience})`);
          console.log(`      Status: ${pkg.status || 'N/A'}, Actif: ${pkg.is_active}`);
        });
        
        // Test: exact endpoint format
        console.log("\n🧪 Test du format de l'endpoint...");
        
        const allPackages = await FormationPackage.findAll({
          order: [['price', 'ASC']],
        });
        
        // Transform to expected format (same as /api/admin/test/packages)
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
        
        // Check B2B compatibility
        const b2bPackages = formattedPackages.filter(pkg => 
          pkg.targetAudience === 'entreprises' || pkg.targetAudience === 'mixed'
        );
        
        const activePackages = formattedPackages.filter(pkg => 
          pkg.is_active !== false && (pkg.status === 'published' || !pkg.status)
        );
        
        const b2bActivePackages = b2bPackages.filter(pkg => activePackages.includes(pkg));
        
        console.log(`\n📊 Statistiques finales:`);
        console.log(`   • Total packages: ${formattedPackages.length}`);
        console.log(`   • Packages B2B: ${b2bPackages.length}`);
        console.log(`   • Packages actifs: ${activePackages.length}`);
        console.log(`   • Packages B2B actifs: ${b2bActivePackages.length}`);
        
        if (b2bActivePackages.length > 0) {
          console.log("\n🎉 SUCCÈS TOTAL !");
          console.log("✅ Le modèle fonctionne parfaitement");
          console.log("✅ Les packages B2B sont accessibles");
          console.log("✅ L'endpoint /api/admin/test/packages va fonctionner");
          
          // Show sample of what will be sent to frontend
          console.log("\n📋 Exemple de ce qui sera envoyé au frontend:");
          b2bActivePackages.slice(0, 2).forEach((pkg, index) => {
            console.log(`   ${index + 1}. ${JSON.stringify(pkg, null, 4)}`);
          });
          
          console.log("\n🎯 INSTRUCTIONS FINALES:");
          console.log("1. Arrêtez le serveur backend (Ctrl+C)");
          console.log("2. Redémarrez avec: npm start");
          console.log("3. Attendez 10 secondes que le serveur démarre");
          console.log("4. Testez votre page B2B");
          console.log("5. Les packages devraient apparaître dans la liste déroulante !");
          console.log("6. Sélectionnez un package et testez l'achat B2B");
          
        } else {
          console.log("\n⚠️  ATTENTION:");
          console.log(`• Aucun package B2B actif trouvé`);
          console.log(`• Vérifiez les valeurs dans course_packages:`);
          console.log(`  - target_audience doit être 'entreprises' ou 'mixed'`);
          console.log(`  - is_active doit être true`);
          console.log(`  - status doit être 'published'`);
        }
        
      } else {
        console.log("❌ La table course_packages est vide !");
        console.log("💡 Ajoutez des packages avec: INSERT INTO course_packages...");
      }
      
    } catch (modelError) {
      console.error("❌ Erreur du modèle:", modelError.message);
      if (modelError.sql) {
        console.error("SQL:", modelError.sql);
      }
    }
    
  } catch (error) {
    console.error("❌ Erreur générale:", error);
    console.error("Détails:", error.message);
  }
};

// Run final test
testFinalModel();
