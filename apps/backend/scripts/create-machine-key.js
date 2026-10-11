/**
 * Crée une clé d'intégration administrateur (scripts d'exploitation) — ADR-0019.
 * Les personnes se connectent par Studies Learning ; cette clé sert uniquement aux machines.
 * La clé s'affiche UNE fois, dans ce terminal ; elle n'est écrite dans aucun journal.
 *
 *   node scripts/create-machine-key.js <nom-de-l-integration>
 */
import { ApiKeyService } from "../services/api-key.service.js";
import { sequelize } from "../models/index.js";

const name = String(process.argv[2] ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-");
if (!name) {
  console.error("Usage : node scripts/create-machine-key.js <nom-de-l-integration>");
  process.exit(1);
}
const record = await ApiKeyService.generate(`admin:${name}`);
process.stdout.write(`Clé créée pour « admin:${name} » (à placer dans le gestionnaire de secrets de l'intégration) :\n${record.key}\n`);
await sequelize.close();
