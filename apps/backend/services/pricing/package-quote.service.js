import { QueryTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { PricingService } from "../../saga/pricing.service.js";
import { AppError, NotFoundError } from "../../utils/errors.js";
import { maxSeatsFromEnv, normalizeCurrency, parsePositiveInt, parseSeats, priceLicences } from "./licence-pricing.js";

/**
 * Devis de licences d'un package B2B — SOURCE UNIQUE DU PRIX (ADR-0004).
 *
 * Un package se vend À LA LICENCE (décision d'Albert, 06/10/2026), comme les thématiques :
 *   prix unitaire = course_packages.price (prix d'UNE licence, fixé par le super admin)
 *                   × (1 − remise du palier de volume actif, sl_volume_breakpoints)
 *   total         = prix unitaire × nombre de licences de la commande
 *
 * `max_licenses` ne plafonne plus la commande (il décrivait le contenu d'un forfait) ;
 * le plafond par commande est PACKAGE_MAX_SEATS_PER_ORDER (défaut 5000).
 * Le palier est choisi sur le nombre de licences de la commande (achat initial comme ajout).
 */
const SELLABLE_STATUSES = new Set(["published", "active"]);

const defaultDeps = {
  async loadPackage(packageId) {
    const [row] = await sequelize.query(
      `SELECT id, name, price, currency, status
         FROM course_packages
        WHERE id = :id
        LIMIT 1`,
      { replacements: { id: packageId }, type: QueryTypes.SELECT },
    );
    return row || null;
  },
  findApplicableBreakpoint: (seats) => PricingService.findApplicableBreakpoint(seats),
  maxSeatsPerOrder: () => maxSeatsFromEnv("PACKAGE_MAX_SEATS_PER_ORDER"),
};

export class PackageQuoteService {
  constructor(deps = {}) {
    this.deps = { ...defaultDeps, ...deps };
  }

  /**
   * @param {unknown} rawPackageId identifiant de package (entier > 0)
   * @param {unknown} rawSeats nombre de licences (entier, 1..max)
   */
  async quote(rawPackageId, rawSeats) {
    const packageId = parsePositiveInt(rawPackageId, "Identifiant de package invalide.");
    const seats = parseSeats(rawSeats, this.deps.maxSeatsPerOrder());

    const row = await this.deps.loadPackage(packageId);
    if (!row) throw new NotFoundError("Package introuvable.");
    if (!SELLABLE_STATUSES.has(String(row.status || "").toLowerCase())) {
      throw new AppError("Ce package n'est pas proposé à la vente actuellement.", 409);
    }
    const currency = normalizeCurrency(row.currency, "du package");
    const breakpoint = await this.deps.findApplicableBreakpoint(seats);
    const priced = priceLicences({ basePrice: row.price, seats, breakpoint, label: "du package" });

    return { packageId, name: row.name, currency, ...priced };
  }
}

export const packageQuoteService = new PackageQuoteService();
