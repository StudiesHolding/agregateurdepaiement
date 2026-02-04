/**
 * Script pour nettoyer les indexes excédentaires de la base de données
 *
 * Usage: node scripts/cleanup-indexes.js
 *
 * ATTENTION: Ce script SUPPRIME des indexes!
 * Vérifiez bien avant d'exécuter.
 *
 * Les indexes supprimés sont ceux créés automatiquement par les FK
 * mais qui ne sont pas strictement nécessaires pour les requêtes.
 */

import sequelize from "../config/database.js";

const DRY_RUN = true; // Mettre false pour réellement supprimer

const indexesToRemove = [
  { table: "aggp_orders", index: "customerEmail", safe: true },
  { table: "aggp_orders", index: "customerName", safe: true },
  { table: "aggp_orders", index: "currency", safe: true },
  { table: "aggp_orders", index: "status", safe: true },
  { table: "aggp_payment_intents", index: "status", safe: true },
  { table: "aggp_payment_intents", index: "currency", safe: true },
  { table: "aggp_payment_intents", index: "selectedProviderId", safe: false }, // FK important
  { table: "aggp_payment_attempts", index: "status", safe: true },
  { table: "aggp_payment_attempts", index: "providerId", safe: false }, // FK important
  { table: "aggp_webhook_events", index: "eventType", safe: true },
  { table: "aggp_webhook_events", index: "processed", safe: true },
  { table: "aggp_webhook_events", index: "providerId", safe: false }, // FK important
  { table: "aggp_provider_routes", index: "countryCode", safe: true },
  { table: "aggp_provider_routes", index: "currency", safe: true },
  { table: "aggp_provider_routes", index: "priority", safe: true },
  { table: "aggp_installment_plans", index: "status", safe: true },
  { table: "aggp_installment_payments", index: "status", safe: true },
];

async function cleanupIndexes() {
  console.log("🧹 Nettoyage des indexes MySQL...\n");

  if (DRY_RUN) {
    console.log(
      "🔸 MODE SIMULATION (DRY RUN) - Aucune modification ne sera faite\n",
    );
  }

  let removedCount = 0;
  let skippedCount = 0;

  for (const { table, index, safe } of indexesToRemove) {
    try {
      // Vérifier si l'index existe
      const [results] = await sequelize.query(
        `SHOW INDEX FROM ${table} WHERE Key_name = ?`,
        {
          replacements: [index],
          type: sequelize.QueryTypes.SHOWINDEX,
        },
      );

      if (results.length === 0) {
        console.log(`⏭️  ${table}.${index}: n'existe pas`);
        continue;
      }

      if (!safe) {
        console.log(`⚠️  ${table}.${index}: index FK important, ignoré`);
        skippedCount++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`🔸 [SIMULATION] Supprimerait: ${table}.${index}`);
        removedCount++;
      } else {
        await sequelize.query(`ALTER TABLE ${table} DROP INDEX ${index}`);
        console.log(`✅ ${table}.${index}: supprimé`);
        removedCount++;
      }
    } catch (error) {
      console.log(`❌ ${table}.${index}: erreur - ${error.message}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  if (DRY_RUN) {
    console.log(`📊 Simulation: ${removedCount} indexes seraient supprimés`);
  } else {
    console.log(`📊 Résultat: ${removedCount} indexes supprimés`);
  }
  console.log(`📊 Ignorés (FK importants): ${skippedCount}`);
  console.log("=".repeat(50));

  if (DRY_RUN) {
    console.log("\n💡 Pour réellement supprimer les indexes, remplacez:");
    console.log("   const DRY_RUN = true;");
    console.log("   par:");
    console.log("   const DRY_RUN = false;");
    console.log("   puis exécutez: node scripts/cleanup-indexes.js");
  }

  await sequelize.close();
}

cleanupIndexes().catch(console.error);
