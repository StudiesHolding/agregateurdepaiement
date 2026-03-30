#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const debugPackagesEndpoint = async () => {
  try {
    console.log("🔍 DÉBOGAGE ENDPOINT PACKAGES");
    console.log("=" .repeat(60));
    
    // Test connection
    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie");
    
    const { FormationPackage } = await import("../models/formation-package.model.js");
    const tableName = FormationPackage.tableName;
    
    console.log(`\n📋 Analyse de la table: ${tableName}`);
    
    // Check if table exists
    const [tableExists] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = '${tableName}'
    `);
    
    if (tableExists[0].count === 0) {
      console.log(`❌ Table ${tableName} n'existe pas !`);
      return;
    }
    
    console.log(`✅ Table ${tableName} existe`);
    
    // Check table structure
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `);
    
    console.log("\n📋 Structure de la table:");
    columns.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Count total packages
    console.log("\n🔍 Test des requêtes:");
    
    try {
      const totalCount = await FormationPackage.count();
      console.log(`✅ Total packages: ${totalCount}`);
      
      if (totalCount === 0) {
        console.log("❌ Aucun package trouvé - la table est vide !");
        console.log("\n💡 Solution: Créer des packages de test");
        await createTestPackages();
        return;
      }
      
      // Test findAll
      console.log("\n🔍 Test FormationPackage.findAll():");
      const packages = await FormationPackage.findAll({
        order: [['price', 'ASC']],
        limit: 5
      });
      
      console.log(`✅ ${packages.length} packages trouvés`);
      
      if (packages.length > 0) {
        console.log("\n📋 Exemples de packages:");
        packages.forEach((pkg, index) => {
          console.log(`   ${index + 1}. ID: ${pkg.id}, Titre: ${pkg.title}, Prix: ${pkg.price} ${pkg.currency}`);
          console.log(`      Status: ${pkg.status}, Target: ${pkg.target_audience}`);
          console.log(`      Image: ${pkg.image_url || 'N/A'}`);
          console.log(`      Formations: ${pkg.formations ? 'Oui' : 'Non'}`);
          console.log(`      Actif: ${pkg.is_active}`);
        });
      }
      
      // Test the exact query from the endpoint
      console.log("\n🔍 Simulation de l'endpoint /api/admin/test/packages:");
      
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
        status: pkg.status,
      }));
      
      console.log(`✅ ${formattedPackages.length} packages formatés pour l'API`);
      
      if (formattedPackages.length > 0) {
        console.log("\n📋 Format envoyé au frontend:");
        formattedPackages.slice(0, 3).forEach((pkg, index) => {
          console.log(`   ${index + 1}. ${JSON.stringify(pkg, null, 6)}`);
        });
      }
      
      // Check for potential issues
      console.log("\n🔍 Vérification des problèmes potentiels:");
      
      // Check if packages are active
      const activePackages = allPackages.filter(pkg => pkg.is_active !== false);
      console.log(`   • Packages actifs: ${activePackages.length}/${allPackages.length}`);
      
      // Check published packages
      const publishedPackages = allPackages.filter(pkg => pkg.status === 'published');
      console.log(`   • Packages publiés: ${publishedPackages.length}/${allPackages.length}`);
      
      // Check B2B target audience
      const b2bPackages = allPackages.filter(pkg => 
        pkg.target_audience === 'entreprises' || pkg.target_audience === 'mixed'
      );
      console.log(`   • Packages B2B: ${b2bPackages.length}/${allPackages.length}`);
      
      if (b2bPackages.length === 0) {
        console.log("\n⚠️  ATTENTION: Aucun package B2B trouvé !");
        console.log("   • target_audience doit être 'entreprises' ou 'mixed'");
        console.log("   • status doit être 'published'");
        console.log("   • is_active doit être true");
      }
      
    } catch (error) {
      console.error("❌ Erreur lors du test:", error.message);
      console.error("SQL:", error.sql);
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("🎯 CONCLUSION:");
    console.log("Si les packages existent mais n'apparaissent pas dans la page test:");
    console.log("1. Vérifiez que les packages sont B2B (target_audience = 'entreprises' ou 'mixed')");
    console.log("2. Vérifiez que les packages sont publiés (status = 'published')");
    console.log("3. Vérifiez que les packages sont actifs (is_active = true)");
    console.log("4. Vérifiez les logs du serveur pour les erreurs de l'endpoint");
    
  } catch (error) {
    console.error("❌ Erreur lors du débogage:", error);
    console.error("Détails:", error.message);
  }
};

const createTestPackages = async () => {
  console.log("\n🔧 Création de packages de test...");
  
  const { FormationPackage } = await import("../models/formation-package.model.js");
  
  const testPackages = [
    {
      title: "Pack B2B - Formation Management",
      description: "Package complet pour la formation des équipes de management",
      price: 2999.99,
      currency: "EUR",
      target_audience: "entreprises",
      status: "published",
      is_active: true,
      image_url: "https://example.com/images/management-pack.jpg",
      formations: JSON.stringify([
        { id: 1, title: "Leadership 101", duration: "2h" },
        { id: 2, title: "Gestion d'équipe", duration: "3h" }
      ])
    },
    {
      title: "Pack B2B - Vente et Négociation",
      description: "Formation spécialisée pour les équipes commerciales",
      price: 1999.99,
      currency: "EUR",
      target_audience: "entreprises",
      status: "published",
      is_active: true,
      image_url: "https://example.com/images/sales-pack.jpg",
      formations: JSON.stringify([
        { id: 3, title: "Techniques de vente", duration: "4h" },
        { id: 4, title: "Négociation avancée", duration: "3h" }
      ])
    },
    {
      title: "Pack Mixte - Développement Personnel",
      description: "Package pour entreprises et particuliers",
      price: 999.99,
      currency: "EUR",
      target_audience: "mixed",
      status: "published",
      is_active: true,
      image_url: "https://example.com/images/personal-pack.jpg",
      formations: JSON.stringify([
        { id: 5, title: "Communication efficace", duration: "2h" }
      ])
    }
  ];
  
  try {
    for (const pkgData of testPackages) {
      const pkg = await FormationPackage.create(pkgData);
      console.log(`   ✅ Package créé: ID ${pkg.id} - ${pkg.title}`);
    }
    
    console.log("\n🎉 Packages de test créés avec succès !");
    console.log("Relancez le script pour vérifier: npm run debug-packages");
    
  } catch (error) {
    console.error("❌ Erreur lors de la création:", error.message);
  }
};

// Run debug
debugPackagesEndpoint();
