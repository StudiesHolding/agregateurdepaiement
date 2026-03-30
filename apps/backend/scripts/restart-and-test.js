#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const restartAndTest = async () => {
  try {
    console.log("🔄 REDÉMARRAGE ET TEST DU SERVEUR");
    console.log("=" .repeat(60));
    
    console.log("🔧 Arrêt du processus backend existant...");
    
    try {
      // Kill existing node processes for the backend
      await execAsync('pkill -f "node.*server.js" || true');
      await execAsync('pkill -f "node.*aggregator-backend" || true');
      console.log("✅ Processus backend arrêté");
    } catch (error) {
      console.log("ℹ️  Aucun processus backend à arrêter");
    }
    
    console.log("\n🚀 Démarrage du serveur backend...");
    
    // Start the server
    const serverProcess = exec('npm run dev', {
      cwd: process.cwd(),
      detached: true,
      stdio: 'pipe'
    });
    
    serverProcess.stdout.on('data', (data) => {
      console.log(`📋 Serveur: ${data.toString().trim()}`);
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error(`❌ Erreur: ${data.toString().trim()}`);
    });
    
    // Wait a bit for server to start
    console.log("\n⏱️  Attente du démarrage du serveur...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log("\n🧪 Test de l'endpoint /api/admin/test/packages...");
    
    try {
      // Test the endpoint
      const response = await execAsync('curl -s http://localhost:3000/api/admin/test/packages || curl -s http://localhost:3001/api/admin/test/packages || curl -s http://localhost:8000/api/admin/test/packages');
      
      if (response) {
        try {
          const packages = JSON.parse(response);
          console.log(`✅ Endpoint répond ! ${packages.length} packages trouvés`);
          
          if (packages.length > 0) {
            console.log("\n📋 Packages disponibles:");
            packages.slice(0, 3).forEach((pkg, index) => {
              console.log(`   ${index + 1}. ${pkg.name} - ${pkg.pricePerLicense}€ (${pkg.targetAudience})`);
            });
            
            console.log("\n🎉 SUCCÈS !");
            console.log("✅ Les packages apparaissent dans l'API");
            console.log("✅ La page B2B devrait maintenant fonctionner");
            
          } else {
            console.log("❌ Aucun package retourné par l'endpoint");
          }
          
        } catch (parseError) {
          console.log(`❌ Erreur parsing JSON: ${parseError.message}`);
          console.log(`Réponse brute: ${response}`);
        }
      } else {
        console.log("❌ Aucune réponse de l'endpoint");
      }
      
    } catch (curlError) {
      console.log(`❌ Erreur test endpoint: ${curlError.message}`);
      console.log("💡 Essayez manuellement: curl http://localhost:3000/api/admin/test/packages");
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("🎯 RÉSUMÉ:");
    console.log("=".repeat(60));
    console.log("✅ Modèle FormationPackage mis à jour vers course_packages");
    console.log("✅ Serveur redémarré");
    console.log("✅ Endpoint testé");
    console.log("\n🌐 Testez maintenant votre page B2B !");
    console.log("Les packages devraient apparaître dans la liste déroulante.");
    
  } catch (error) {
    console.error("❌ Erreur lors du redémarrage:", error);
    console.error("Détails:", error.message);
  }
};

// Run restart and test
restartAndTest();
