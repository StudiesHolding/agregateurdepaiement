/**
 * Script pour vérifier et nettoyer les indexes de la base de données
 *
 * Usage: node scripts/check-indexes.js
 *
 * Ce script:
 * 1. Affiche tous les indexes actuels de chaque table
 * 2. Calcule le total d'indexes
 * 3. Propose de supprimer les indexes non essentiels
 */

import sequelize from "../config/database.js";

async function checkIndexes() {
  console.log("🔍 Vérification des indexes MySQL...\n");

  const tables = [
    "aggp_orders",
    "aggp_payment_intents",
    "aggp_payment_attempts",
    "aggp_webhook_events",
    "aggp_payment_providers",
    "aggp_provider_routes",
    "aggp_installment_plans",
    "aggp_installment_payments",
    "aggp_api_keys",
    "aggp_verified_emails",
  ];

  let totalIndexes = 0;
  const allIndexes = {};

  for (const table of tables) {
    try {
      const [results] = await sequelize.query(`SHOW INDEX FROM ${table}`, {
        type: sequelize.QueryTypes.SHOWINDEX,
      });

      const tableIndexes = results.reduce((acc, idx) => {
        if (!acc[idx.Key_name]) {
          acc[idx.Key_name] = [];
        }
        acc[idx.Key_name].push(idx.Column_name);
        return acc;
      }, {});

      allIndexes[table] = tableIndexes;
      const count = results.length;
      totalIndexes += count;

      console.log(`📊 ${table}: ${count} indexes`);
      for (const [keyName, columns] of Object.entries(tableIndexes)) {
        const isPrimary = keyName === "PRIMARY";
        const type = isPrimary ? "🔑 PRIMARY" : "📑 INDEX";
        console.log(`   ${type} ${keyName}: [${columns.join(", ")}]`);
      }
      console.log("");
    } catch (error) {
      console.log(`⚠️  Table ${table} non trouvée ou erreur: ${error.message}`);
    }
  }

  console.log("=".repeat(50));
  console.log(`📈 TOTAL DES INDEXES: ${totalIndexes}`);
  console.log("=".repeat(50));

  if (totalIndexes >= 64) {
    console.log("\n⚠️  ATTENTION: Vous êtes à la limite de 64 indexes MySQL!");
    console.log("\n💡 Indexes recommandés à SUPPRIMER (si non utilisés):");

    // Liste des indexes potentiellement non essentiels
    const nonEssentialIndexes = [
      {
        table: "aggp_orders",
        index: "customerEmail",
        reason: "Rarement utilisé pour la recherche",
      },
      {
        table: "aggp_orders",
        index: "customerName",
        reason: "Rarement utilisé pour la recherche",
      },
      {
        table: "aggp_orders",
        index: "currency",
        reason: "Déjà filtré par contexte",
      },
      {
        table: "aggp_orders",
        index: "status",
        reason: "Statut fréquemment changé",
      },
      {
        table: "aggp_payment_intents",
        index: "status",
        reason: "Déjà filtré par FK",
      },
      {
        table: "aggp_payment_attempts",
        index: "status",
        reason: "Rarement recherché seul",
      },
      {
        table: "aggp_webhook_events",
        index: "eventType",
        reason: "Webhook traités en batch",
      },
      {
        table: "aggp_webhook_events",
        index: "processed",
        reason: "Déjà filtré par date",
      },
    ];

    for (const idx of nonEssentialIndexes) {
      console.log(`   - ${idx.table}.${idx.index}: ${idx.reason}`);
    }

    console.log("\n🔧 Pour supprimer un index:");
    console.log(
      `   ALTER TABLE ${nonEssentialIndexes[0].table} DROP INDEX ${nonEssentialIndexes[0].index};`,
    );
  } else {
    console.log(
      "\n✅ Vous avez encore de la marge avant la limite de 64 indexes.",
    );
  }

  await sequelize.close();
}

checkIndexes().catch(console.error);
