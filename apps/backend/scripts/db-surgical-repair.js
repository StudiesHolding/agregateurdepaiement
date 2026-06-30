#!/usr/bin/env node

import { sequelize } from "../models/index.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Ce script compare les définitions Sequelize avec la base MariaDB réelle.
 * Il ne supprime JAMAIS de tables ni de colonnes.
 * Il génère et exécute uniquement des ALTER TABLE chirurgicaux pour restaurer :
 * - AUTO_INCREMENT
 * - NOT NULL
 * - DEFAULT values
 */
const runSurgicalRepair = async () => {
  try {
    console.log("🩺 DÉBUT DE LA RÉPARATION CHIRURGICALE DB (AGRÉGATEUR)");
    console.log("=".repeat(80));

    await sequelize.authenticate();
    console.log("✅ Connexion à la base de données établie\n");

    const models = sequelize.models;
    let totalFixes = 0;

    for (const modelName of Object.keys(models)) {
      const model = models[modelName];
      const tableName = model.tableName;

      // Récupérer la structure réelle de la table
      const [tableColumns] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default, extra, column_type
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() AND table_name = '${tableName}'
      `);

      if (tableColumns.length === 0) {
        console.log(`⚠️ Table ignorée car inexistante : ${tableName} (lancez les migrations d'abord)`);
        continue;
      }

      console.log(`🔍 Analyse de la table : ${tableName}`);
      let hasFixes = false;

      for (const [colName, colDef] of Object.entries(model.rawAttributes)) {
        const actualCol = tableColumns.find(c => c.column_name === colName);
        if (!actualCol) continue; // On ne gère pas les colonnes manquantes ici

        const needsFix = [];
        let alterDef = actualCol.column_type; // ex: int(11), varchar(255)

        // 1. Vérification AUTO_INCREMENT
        const shouldBeAutoInc = colDef.autoIncrement === true;
        const isAutoInc = actualCol.extra.toLowerCase().includes('auto_increment');
        if (shouldBeAutoInc && !isAutoInc) {
          needsFix.push('AUTO_INCREMENT manquant');
          alterDef += ' AUTO_INCREMENT';
        }

        // 2. Vérification NULLABLE
        const shouldBeNull = colDef.allowNull !== false && !colDef.primaryKey;
        const isNull = actualCol.is_nullable === 'YES';
        if (!shouldBeNull && isNull) {
          needsFix.push('Devrait être NOT NULL');
          alterDef += ' NOT NULL';
        } else if (shouldBeNull && !isNull) {
            alterDef += ' NULL';
        } else {
             alterDef += isNull ? ' NULL' : ' NOT NULL';
        }

        // 3. Vérification DEFAULT
        let shouldHaveDefault = colDef.defaultValue !== undefined;
        let isDefaultMatching = true;
        let defValueStr = '';

        if (shouldHaveDefault) {
            if (typeof colDef.defaultValue === 'object' && colDef.defaultValue.constructor.name === 'NOW') {
                if (!actualCol.column_default || !actualCol.column_default.toUpperCase().includes('CURRENT_TIMESTAMP')) {
                    needsFix.push('DEFAULT CURRENT_TIMESTAMP manquant');
                    isDefaultMatching = false;
                    defValueStr = ' DEFAULT CURRENT_TIMESTAMP';
                }
            } else if (typeof colDef.defaultValue === 'boolean') {
                 const dbVal = colDef.defaultValue ? '1' : '0';
                 if (actualCol.column_default !== dbVal) {
                     needsFix.push(`DEFAULT ${dbVal} manquant`);
                     isDefaultMatching = false;
                     defValueStr = ` DEFAULT '${dbVal}'`;
                 }
            } else if (typeof colDef.defaultValue === 'string' || typeof colDef.defaultValue === 'number') {
                 if (actualCol.column_default !== String(colDef.defaultValue)) {
                     needsFix.push(`DEFAULT ${colDef.defaultValue} manquant`);
                     isDefaultMatching = false;
                     defValueStr = ` DEFAULT '${colDef.defaultValue}'`;
                 }
            }
        }
        
        alterDef += defValueStr;

        if (needsFix.length > 0) {
          hasFixes = true;
          totalFixes++;
          console.log(`   ⚠️ Colonne '${colName}' altérée : ${needsFix.join(', ')}`);
          
          const alterQuery = `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${colName}\` ${alterDef};`;
          console.log(`      > Exécution : ${alterQuery}`);
          
          try {
            await sequelize.query(alterQuery);
            console.log(`      ✅ Correction appliquée avec succès`);
          } catch (err) {
            console.log(`      ❌ Échec de la correction : ${err.message}`);
          }
        }
      }

      if (!hasFixes) {
        console.log(`   ✅ Parfaitement saine`);
      }
    }

    console.log("=".repeat(80));
    console.log(`🎉 OPÉRATION TERMINÉE. Total des correctifs appliqués : ${totalFixes}`);
    process.exit(0);

  } catch (error) {
    console.error("❌ Erreur critique:", error);
    process.exit(1);
  }
};

runSurgicalRepair();
