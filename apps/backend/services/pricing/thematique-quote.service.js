import { QueryTypes } from "sequelize";
import sequelize from "../../config/database.js";
import { PricingService } from "../../saga/pricing.service.js";
import { AppError, BadRequestError, NotFoundError } from "../../utils/errors.js";

/**
 * Devis de licences de thématique B2B — SOURCE UNIQUE DU PRIX (ADR-0004, ADR-0008).
 *
 *   prix unitaire = prix de base du TYPE de la thématique (sl_thematique_types.base_price,
 *                   fixé par le super admin) × (1 − remise du palier de volume actif)
 *   total         = prix unitaire × nombre de licences
 *
 * Paliers : sl_volume_breakpoints (administrés par le super admin).
 * Arithmétique en centimes entiers (BigInt) : aucun flottant sur un montant.
 * Rien ne vient du navigateur hormis l'identifiant et le nombre de licences, validés ici.
 */
export const DEFAULT_MAX_SEATS_PER_ORDER = 5000;

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
  maxSeatsPerOrder: () => {
    const configured = Number(process.env.THEMATIQUE_MAX_SEATS_PER_ORDER);
    return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_SEATS_PER_ORDER;
  },
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
    const maxSeats = this.deps.maxSeatsPerOrder();
    const seats = parsePositiveInt(rawSeats, `Nombre de licences invalide : entre 1 et ${maxSeats}.`);
    if (seats > maxSeats) {
      throw new BadRequestError(`Nombre de licences invalide : entre 1 et ${maxSeats} par commande.`);
    }

    const row = await this.deps.loadThematique(thematiqueId);
    if (!row) throw new NotFoundError("Thématique introuvable.");
    if (row.thematique_status !== "ACTIVE" || row.type_status !== "ACTIVE") {
      throw new AppError("Cette thématique n'est pas proposée à la vente actuellement.", 409);
    }

    const baseCents = toCents(row.base_price);
    if (baseCents <= 0n) {
      throw new AppError("Prix de base de la thématique invalide : contactez l'équipe commerciale.", 409);
    }

    const breakpoint = await this.deps.findApplicableBreakpoint(seats);
    const discountBps = breakpoint ? rateToBasisPoints(breakpoint.discount_rate) : 0n;
    if (discountBps < 0n || discountBps >= 10000n) {
      throw new AppError("Palier de remise mal configuré : contactez l'équipe commerciale.", 409);
    }
    // Prix unitaire arrondi au centime (demi supérieur), puis multiplié : total exact.
    const unitCents = roundHalfUpDiv(baseCents * (10000n - discountBps), 10000n);
    const totalCents = unitCents * BigInt(seats);

    return {
      thematiqueId,
      title: row.title,
      typeName: row.type_name,
      seats,
      currency: String(row.currency || "").toUpperCase(),
      basePrice: centsToDecimal(baseCents),
      unitPrice: centsToDecimal(unitCents),
      discountRate: basisPointsToRate(discountBps),
      discountLabel: breakpoint ? breakpoint.label : null,
      total: centsToDecimal(totalCents),
      breakpoint: breakpoint
        ? { id: breakpoint.id, minSeats: breakpoint.min_seats, maxSeats: breakpoint.max_seats ?? null }
        : null,
    };
  }
}

export const thematiqueQuoteService = new ThematiqueQuoteService();

// ─── Arithmétique décimale exacte ───────────────────────────────────────────

function parsePositiveInt(raw, message) {
  const text = String(raw ?? "").trim();
  if (!/^\d{1,9}$/.test(text) || Number(text) < 1) throw new BadRequestError(message);
  return Number(text);
}

/** "15000.50" → 1500050n ; refuse tout ce qui n'est pas un décimal positif. */
function toCents(value) {
  const text = String(value ?? "").trim();
  const match = /^(\d+)(?:\.(\d{1,}))?$/.exec(text);
  if (!match) return -1n;
  const frac = (match[2] || "").padEnd(3, "0");
  let cents = BigInt(match[1]) * 100n + BigInt(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) cents += 1n;
  return cents;
}

/** Taux décimal ("0.15", "0.1250") → points de base (1500n, 1250n). */
function rateToBasisPoints(rate) {
  const text = String(rate ?? "0").trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return -1n;
  const frac = (match[2] || "").padEnd(5, "0");
  let bps = BigInt(match[1]) * 10000n + BigInt(frac.slice(0, 4));
  if (Number(frac[4]) >= 5) bps += 1n;
  return bps;
}

function roundHalfUpDiv(numerator, denominator) {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

function centsToDecimal(cents) {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}

function basisPointsToRate(bps) {
  return `${bps / 10000n}.${String(bps % 10000n).padStart(4, "0")}`;
}
