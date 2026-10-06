import { QueryTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { PricingService } from "../../saga/pricing.service.js";
import { AppError, NotFoundError } from "../../utils/errors.js";
import {
  DEFAULT_MAX_SEATS_PER_ORDER,
  maxSeatsFromEnv,
  normalizeCurrency,
  parsePositiveInt,
  parseSeats,
  priceLicences,
} from "./licence-pricing.js";

/**
 * Devis de licences de thématique B2B — SOURCE UNIQUE DU PRIX (ADR-0004, ADR-0008).
 *
 *   prix unitaire = prix de base du TYPE de la thématique (sl_thematique_types.base_price,
 *                   fixé par le super admin) × (1 − remise du palier de volume actif)
 *   total         = prix unitaire × nombre de licences
 *
 * Paliers : sl_volume_breakpoints (administrés par le super admin).
 * Arithmétique exacte : voir licence-pricing.js.
 * Rien ne vient du navigateur hormis l'identifiant et le nombre de licences, validés ici.
 */
export { DEFAULT_MAX_SEATS_PER_ORDER };

const defaultDeps = {
  /** Thématique + type (prix de base, devise, statuts). */
  async loadThematique(thematiqueId) {
    const [row] = await sequelize.query(
      `SELECT bt.id, bt.title, bt.status AS thematique_status,
              tt.name AS type_name, tt.base_price, tt.currency, tt.status AS type_status
         FROM sl_business_thematiques bt
         JOIN sl_thematique_types tt ON tt.id = bt.thematique_type_id
        WHERE bt.id = :id
        LIMIT 1`,
      { replacements: { id: thematiqueId }, type: QueryTypes.SELECT },
    );
    return row || null;
  },
  findApplicableBreakpoint: (seats) => PricingService.findApplicableBreakpoint(seats),
  maxSeatsPerOrder: () => maxSeatsFromEnv("THEMATIQUE_MAX_SEATS_PER_ORDER"),
};

export class ThematiqueQuoteService {
  constructor(deps = {}) {
    this.deps = { ...defaultDeps, ...deps };
  }

  /**
   * @param {unknown} rawThematiqueId identifiant de thématique (entier > 0)
   * @param {unknown} rawSeats nombre de licences (entier, 1..max)
   */
  async quote(rawThematiqueId, rawSeats) {
    const thematiqueId = parsePositiveInt(rawThematiqueId, "Identifiant de thématique invalide.");
    const seats = parseSeats(rawSeats, this.deps.maxSeatsPerOrder());

    const row = await this.deps.loadThematique(thematiqueId);
    if (!row) throw new NotFoundError("Thématique introuvable.");
    if (row.thematique_status !== "ACTIVE" || row.type_status !== "ACTIVE") {
      throw new AppError("Cette thématique n'est pas proposée à la vente actuellement.", 409);
    }
    const currency = normalizeCurrency(row.currency, "de la thématique");
    const breakpoint = await this.deps.findApplicableBreakpoint(seats);
    const priced = priceLicences({ basePrice: row.base_price, seats, breakpoint, label: "de la thématique" });

    return { thematiqueId, title: row.title, typeName: row.type_name, currency, ...priced };
  }
}

export const thematiqueQuoteService = new ThematiqueQuoteService();
