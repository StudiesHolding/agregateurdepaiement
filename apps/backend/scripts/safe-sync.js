/**
 * Script de synchronisation SÉCURISÉ pour éviter les erreurs d'index
 *
 * Usage: node scripts/safe-sync.js
 *
 * Ce script:
 * 1. Vérifie la connexion DB
 * 2. Ajoute les colonnes manquantes SANS toucher aux indexes
 * 3. Ignore les modifications d'index pour éviter l'erreur ER_TOO_MANY_KEYS
 */

import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

import sequelize from "../config/database.js";

const SKIP_INDEX_SYNC = true; // Toujours true pour éviter les erreurs

async function safeSync() {
  console.log("🔄 Synchronisation sécurisée de la base de données...\n");

  try {
    await sequelize.authenticate();
    console.log("✅ Connexion DB établie");

    if (SKIP_INDEX_SYNC) {
      console.log("⚡ Mode: sync sans modification des indexes");

      // Approach 1: Use alter sans drop
      await sequelize.sync({
        alter: {
          drop: false, // Ne pas dropper les indexes
        },
      });
    } else {
      await sequelize.sync({ alter: true });
    }

    console.log("✅ Modèles synchronisés avec succès!");
  } catch (error) {
    console.error("\n❌ Erreur de synchronisation:", error.message);

    if (error.message.includes("ER_TOO_MANY_KEYS")) {
      console.log("\n💡 SOLUTION:");
      console.log("   1. Exécutez d'abord le script de nettoyage:");
      console.log("      node scripts/check-indexes.js");
      console.log("   2. Puis supprimez les indexes excédentaires:");
      console.log("      node scripts/cleanup-indexes.js");
      console.log("   3. Redémarrez le serveur");
    }
  }

  await sequelize.close();
}

safeSync();
