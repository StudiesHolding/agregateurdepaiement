/**
 * Remise en ordre du schéma de l'agrégateur (ADR-0019, D8) — rejouable, lecture seule par défaut.
 *
 * Des synchronisations successives ont laissé, dans certaines tables `aggp_*`, chaque colonne en DOUBLE
 * (`provider_id` et `providerId`…). Le modèle n'en utilise qu'une ; l'autre reste souvent NOT NULL sans valeur par
 * défaut et fait échouer les insertions (création d'une règle de routage, par exemple), ou garde des données que les
 * analyses ne voient pas.
 *
 * Pour chaque modèle Sequelize dont la table appartient à l'agrégateur (`aggp_*` seulement) :
 *  - colonne utilisée par le modèle ABSENTE mais jumelle présente → la jumelle est renommée ;
 *  - jumelle en trop → ses données complètent la colonne utilisée (là où elle est vide), puis elle est supprimée ;
 *  - colonne utilisée absente sans jumelle → signalée (à créer par migration).
 *
 *   node scripts/schema-doctor.js           → diagnostic, aucune écriture
 *   node scripts/schema-doctor.js --apply   → corrige (sauvegarde de la base recommandée avant, en production)
 */
import { sequelize } from "../models/index.js";

const apply = process.argv.includes("--apply");
const norm = (s) => s.toLowerCase().replace(/_/g, "");
const q = async (sql, replacements) => (await sequelize.query(sql, { replacements, logging: false }))[0];

let issues = 0;
let fixed = 0;
for (const model of Object.values(sequelize.models)) {
  const table = model.getTableName();
  const tableName = typeof table === "string" ? table : table.tableName;
  // Uniquement les tables de l'agrégateur : jamais celles de WordPress (kyd4_*) ni du backend métier (sl_*).
  if (!tableName.startsWith("aggp_")) continue;
  const columns = (await q("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t", { t: tableName })).map((c) => c.name);
  if (!columns.length) continue;
  const fields = [...new Set(Object.values(model.getAttributes()).map((a) => a.field))];
  const lines = [];

  for (const field of fields) {
    const twins = columns.filter((c) => c !== field && !fields.includes(c) && norm(c) === norm(field));
    if (!columns.includes(field)) {
      if (twins.length) {
        lines.push(`  renommer ${twins[0]} → ${field}`);
        if (apply) { await q(`ALTER TABLE \`${tableName}\` RENAME COLUMN \`${twins[0]}\` TO \`${field}\``); fixed++; }
        twins.shift();
      } else {
        lines.push(`  ! colonne ${field} absente (à créer par migration)`);
      }
    }
    for (const twin of twins) {
      const [n] = await q(`SELECT COUNT(*) AS n FROM \`${tableName}\` WHERE \`${field}\` IS NULL AND \`${twin}\` IS NOT NULL`).catch(() => [{ n: "?" }]);
      lines.push(`  doublon ${twin} (utilisée : ${field}) — ${n.n} valeur(s) à reprendre, puis suppression`);
      if (apply) {
        if (n.n !== "?" && Number(n.n) > 0) await q(`UPDATE \`${tableName}\` SET \`${field}\` = \`${twin}\` WHERE \`${field}\` IS NULL AND \`${twin}\` IS NOT NULL`);
        // Clé étrangère portée par la jumelle : elle est reportée sur la colonne utilisée (mêmes règles), puis retirée.
        const fks = await q("SELECT k.CONSTRAINT_NAME AS name, k.REFERENCED_TABLE_NAME AS refTable, k.REFERENCED_COLUMN_NAME AS refColumn, r.UPDATE_RULE AS onUpdate, r.DELETE_RULE AS onDelete FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = :t AND k.COLUMN_NAME = :c AND k.REFERENCED_TABLE_NAME IS NOT NULL", { t: tableName, c: twin });
        try {
          for (const fk of fks) {
            await q(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${fk.name}\``);
            const [already] = await q("SELECT COUNT(*) AS n FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c AND REFERENCED_TABLE_NAME IS NOT NULL", { t: tableName, c: field });
            if (Number(already.n) === 0) {
              const fkName = `fk_${tableName}_${field}`.slice(0, 64);
              try {
                await q(`ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${fkName}\` FOREIGN KEY (\`${field}\`) REFERENCES \`${fk.refTable}\` (\`${fk.refColumn}\`) ON UPDATE ${fk.onUpdate} ON DELETE ${fk.onDelete}`);
                lines.push(`    clé étrangère reportée sur ${field}`);
              } catch (fkErr) {
                lines.push(`    ! clé étrangère non recréée sur ${field} (types ou valeurs incompatibles) : ${fkErr.message}`);
              }
            }
          }
          await q(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${twin}\``);
          fixed++;
        } catch (err) { lines.push(`    échec de suppression : ${err.message}`); }
      }
    }
  }
  if (lines.length) {
    issues += lines.length;
    console.log(`${tableName} (${model.name})`);
    for (const l of lines) console.log(l);
  }
}
console.log(issues ? `${issues} point(s) ${apply ? `traité(s), ${fixed} correction(s)` : "relevé(s)"}.` : "Schéma conforme aux modèles.");
if (!apply && issues) console.log("Lecture seule. Relancer avec --apply pour corriger (sauvegarde recommandée).");
await sequelize.close();
