/**
 * Routage v2 (ADR-0019, D2) — migration des données, rejouable.
 *  1. Ajoute la colonne `payment_method` aux règles (any | card | mobile_money), « any » par défaut.
 *  2. Transforme en règles explicites ce que le code décidait jusqu'ici en dur, pour conserver le comportement :
 *     - carte → Stripe pour EUR, USD, XAF, XOF, tous pays ;
 *     - Mobile Money → CinetPay (puis KkiaPay au Bénin et au Cameroun) dans les pays de la zone CFA couverts.
 *     Une règle n'est créée que si le prestataire existe et qu'aucune règle équivalente n'existe déjà.
 *
 *   node scripts/migrate-routing-v2.js          → montre ce qui serait fait (aucune écriture)
 *   node scripts/migrate-routing-v2.js --apply  → applique
 */
import sequelize from "../config/database.js";

const apply = process.argv.includes("--apply");
const q = async (sql, replacements) => (await sequelize.query(sql, { replacements, logging: false }))[0];

const [col] = await q("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'aggp_provider_routes' AND COLUMN_NAME = 'payment_method'");
if (Number(col.n) === 0) {
  console.log("- colonne payment_method absente : ajout");
  // Règles existantes : même sens qu'avant (l'ancien moteur ne s'en servait que pour le Mobile Money ; la carte
  // allait toujours à Stripe). Fait une seule fois, à l'ajout de la colonne : les choix ultérieurs ne sont jamais écrasés.
  const existing = await q("SELECT r.id, LOWER(p.code) AS code, r.country_code, r.currency FROM aggp_provider_routes r JOIN aggp_payment_providers p ON p.id = r.provider_id");
  for (const r of existing) console.log(`  ~ règle ${r.id} (${r.code} · ${r.country_code} · ${r.currency}) → ${r.code === "stripe" ? "card" : "mobile_money"}`);
  if (apply) {
    await q("ALTER TABLE aggp_provider_routes ADD COLUMN payment_method ENUM('any','card','mobile_money') NOT NULL DEFAULT 'any' AFTER currency");
    await q("UPDATE aggp_provider_routes r JOIN aggp_payment_providers p ON p.id = r.provider_id SET r.payment_method = IF(LOWER(p.code) = 'stripe', 'card', 'mobile_money')");
  }
} else {
  console.log("- colonne payment_method présente");
}

const providers = Object.fromEntries((await q("SELECT id, LOWER(code) AS code FROM aggp_payment_providers")).map((p) => [p.code, Number(p.id)]));
const XOF = ["CI", "SN", "BJ", "TG", "BF", "ML", "NE"];
const wanted = [
  ...["EUR", "USD", "XAF", "XOF"].map((currency) => ({ code: "stripe", countryCode: "*", currency, paymentMethod: "card", priority: 10 })),
  { code: "cinetpay", countryCode: "CM", currency: "XAF", paymentMethod: "mobile_money", priority: 10 },
  { code: "kkiapay", countryCode: "CM", currency: "XAF", paymentMethod: "mobile_money", priority: 20 },
  ...XOF.map((c) => ({ code: c === "BJ" ? "kkiapay" : "cinetpay", countryCode: c, currency: "XOF", paymentMethod: "mobile_money", priority: 10 })),
  { code: "cinetpay", countryCode: "BJ", currency: "XOF", paymentMethod: "mobile_money", priority: 20 },
];

const hasMethod = Number(col.n) > 0 || apply;
let created = 0;
for (const w of wanted) {
  const providerId = providers[w.code];
  if (!providerId) { console.log(`  · ${w.code} absent : règle ${w.countryCode} ${w.currency} ${w.paymentMethod} ignorée`); continue; }
  const [exists] = await q(
    `SELECT COUNT(*) AS n FROM aggp_provider_routes WHERE provider_id = :providerId AND country_code = :countryCode AND currency = :currency${hasMethod && Number(col.n) > 0 ? " AND payment_method IN (:paymentMethod, 'any')" : ""}`,
    { providerId, ...w },
  );
  if (Number(exists.n) > 0) continue;
  console.log(`  + ${w.code} · ${w.countryCode} · ${w.currency} · ${w.paymentMethod} · priorité ${w.priority}`);
  created++;
  if (apply) {
    await q(
      "INSERT INTO aggp_provider_routes (provider_id, country_code, currency, payment_method, min_amount, max_amount, priority, is_active, created_at, updated_at) VALUES (:providerId, :countryCode, :currency, :paymentMethod, 0, NULL, :priority, 1, NOW(), NOW())",
      { providerId, ...w },
    );
  }
}
console.log(created ? `${created} règle(s) ${apply ? "créée(s)" : "à créer"}.` : "Aucune règle à créer.");
if (!apply) console.log("Lecture seule. Relancer avec --apply pour appliquer.");
await sequelize.close();
