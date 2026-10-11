/**
 * Répare les clés primaires numériques créées sans AUTO_INCREMENT (tables aggp_*).
 * Symptôme : chaque INSERT après le premier échoue (« Validation error », id = 0 en double) — le journal
 * d'administration, les notifications, les routes… n'enregistrent plus rien, silencieusement.
 *
 * Non destructif : le type exact de la colonne est conservé et une ligne existante d'identifiant 0 garde son
 * identifiant (NO_AUTO_VALUE_ON_ZERO pendant la modification). Rejouable : seules les colonnes fautives sont touchées.
 *
 *   node scripts/fix-auto-increment.js          → liste ce qui serait corrigé (aucune écriture)
 *   node scripts/fix-auto-increment.js --apply  → corrige
 */
import sequelize from "../config/database.js";

const apply = process.argv.includes("--apply");

const [columns] = await sequelize.query(`
  SELECT c.TABLE_NAME AS tableName, c.COLUMN_NAME AS columnName, c.COLUMN_TYPE AS columnType
  FROM information_schema.COLUMNS c
  JOIN information_schema.KEY_COLUMN_USAGE k
    ON k.TABLE_SCHEMA = c.TABLE_SCHEMA AND k.TABLE_NAME = c.TABLE_NAME AND k.COLUMN_NAME = c.COLUMN_NAME AND k.CONSTRAINT_NAME = 'PRIMARY'
  WHERE c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME LIKE 'aggp\\_%'
    AND c.DATA_TYPE IN ('tinyint','smallint','mediumint','int','bigint')
    AND c.EXTRA NOT LIKE '%auto_increment%'
    AND (SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE k2
         WHERE k2.TABLE_SCHEMA = c.TABLE_SCHEMA AND k2.TABLE_NAME = c.TABLE_NAME AND k2.CONSTRAINT_NAME = 'PRIMARY') = 1
  ORDER BY c.TABLE_NAME`, { logging: false });

if (!columns.length) {
  console.log("Aucune clé primaire à corriger.");
} else {
  console.log(`${columns.length} clé(s) primaire(s) sans AUTO_INCREMENT :`);
  for (const c of columns) console.log(`  - ${c.tableName}.${c.columnName} (${c.columnType})`);
  if (apply) {
    await sequelize.query("SET SESSION sql_mode = CONCAT(@@SESSION.sql_mode, ',NO_AUTO_VALUE_ON_ZERO')", { logging: false });
    for (const c of columns) {
      await sequelize.query(`ALTER TABLE \`${c.tableName}\` MODIFY \`${c.columnName}\` ${c.columnType} NOT NULL AUTO_INCREMENT`, { logging: false });
      console.log(`  corrigé : ${c.tableName}.${c.columnName}`);
    }
  } else {
    console.log("Lecture seule. Relancer avec --apply pour corriger.");
  }
}
await sequelize.close();
