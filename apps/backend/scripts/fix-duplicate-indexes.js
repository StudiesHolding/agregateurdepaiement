/**
 * Script pour SUPPRIMER tous les indexes dupliqués de la base de données
 *
 * ATTENTION: Ce script SUPPRIME définitivement les indexes!
 *
 * Problème identifié:
 * - Sequelize avec `unique: true` crée des indexes _2, _3, etc. à chaque sync
 * - MySQL limite à 64 indexes par table
 *
 * Solution: Supprimer tous les indexes дублиqués (garder seulement l'original)
 */

import sequelize from "../config/database.js";

const DRY_RUN = false; // Mettre false pour réellement supprimer

const tablesWithDuplicates = [
  { table: "aggp_orders", baseIndex: "reference" },
  { table: "aggp_payment_intents", baseIndex: "idempotency_key" },
  { table: "aggp_payment_providers", baseIndex: "code" },
  { table: "aggp_api_keys", baseIndex: "key" },
  { table: "aggp_verified_emails", baseIndex: "email" },
];

async function dropDuplicateIndexes() {
  console.log("🧹 Suppression des indexes dupliqués...\n");

  if (DRY_RUN) {
    console.log("🔸 MODE SIMULATION - Aucune modification ne sera faite\n");
  }

  let totalDropped = 0;
  let totalSkipped = 0;

  for (const { table, baseIndex } of tablesWithDuplicates) {
    console.log(`📋 Table: ${table}`);

    try {
      // Récupérer tous les indexes de la table
      const [results] = await sequelize.query(`SHOW INDEX FROM ${table}`, {
        type: sequelize.QueryTypes.SHOWINDEX,
      });

      // Grouper par nom d'index
      const indexGroups = results.reduce((acc, idx) => {
        if (!acc[idx.Key_name]) {
          acc[idx.Key_name] = [];
        }
        acc[idx.Key_name].push(idx.Column_name);
        return acc;
      }, {});

      // Trouver les indexes дублиqués (ceux avec suffixe _2, _3, etc.)
      const duplicateIndexes = Object.keys(indexGroups).filter((keyName) => {
        // Ignorer PRIMARY
        if (keyName === "PRIMARY") return false;

        // Garder l'index de base (sans suffixe)
        if (keyName === baseIndex) return false;

        // Supprimer les дублиqués (_2, _3, ...)
        return (
          keyName.startsWith(baseIndex + "_") ||
          keyName.includes("_" + baseIndex + "_") ||
          (keyName.includes("_") && !isNaN(keyName.split("_").pop()))
        );
      });

      console.log(`   Trouvés: ${duplicateIndexes.length} indexes дублиqués`);

      for (const idxName of duplicateIndexes) {
        if (DRY_RUN) {
          console.log(`   🔸 [SIMULATION] Supprimerait: ${idxName}`);
          totalDropped++;
        } else {
          try {
            await sequelize.query(`ALTER TABLE ${table} DROP INDEX ${idxName}`);
            console.log(`   ✅ Supprimé: ${idxName}`);
            totalDropped++;
          } catch (error) {
            console.log(`   ❌ Erreur sur ${idxName}: ${error.message}`);
            totalSkipped++;
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Erreur table ${table}: ${error.message}`);
    }

    console.log("");
  }

  console.log("=".repeat(50));
  if (DRY_RUN) {
    console.log(`📊 Simulation: ${totalDropped} indexes seraient supprimés`);
  } else {
    console.log(`📊 Résultat: ${totalDropped} indexes supprimés`);
    console.log(`📊 Erreurs: ${totalSkipped}`);
  }
  console.log("=".repeat(50));

  if (!DRY_RUN) {
    console.log(
      "\n✅ Redémarrez votre serveur pour vérifier que tout fonctionne!",
    );
  } else {
    console.log(
      "\n💡 Pour réellement supprimer, changez DRY_RUN = true → false",
    );
  }

  await sequelize.close();
}

dropDuplicateIndexes().catch(console.error);
