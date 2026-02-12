import { sequelize, ApiKey } from "../models/index.js";

async function checkApiKey() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    const keyToCheck =
      process.argv[2] || "sk_23abc297660a0cab827003e66e8bd7f92af447c3b63ca5d7";

    console.log(`\nRecherche de la clé: ${keyToCheck}\n`);

    const apiKey = await ApiKey.findOne({
      where: { key: keyToCheck },
    });

    if (apiKey) {
      console.log("✅ Clé trouvée dans la base de données:");
      console.log(`   ID: ${apiKey.id}`);
      console.log(`   Owner: ${apiKey.owner}`);
      console.log(`   isActive: ${apiKey.isActive}`);
      console.log(`   Created: ${apiKey.createdAt}`);
      console.log(`   Last Used: ${apiKey.lastUsedAt}`);
    } else {
      console.log("❌ Clé NON trouvée dans la base de données");
      console.log("\nClés existantes dans la base de données:");
      const allKeys = await ApiKey.findAll({
        limit: 10,
        order: [["createdAt", "DESC"]],
      });
      if (allKeys.length === 0) {
        console.log("   (Aucune clé trouvée)");
      } else {
        allKeys.forEach((k) => {
          console.log(
            `   - ${k.key.substring(0, 20)}... (Owner: ${k.owner}, Active: ${k.isActive})`,
          );
        });
      }
    }
  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await sequelize.close();
  }
}

checkApiKey();
