import { AppError, BadRequestError } from "../../utils/errors.js";

/**
 * Tarification à la licence (B2B) — arithmétique commune aux devis de thématiques et de packages
 * (ADR-0004) : prix unitaire = prix de base × (1 − remise du palier de volume), total = prix unitaire × licences.
 *
 * Centimes entiers (BigInt) et points de base : aucun flottant sur un montant.
 */
export const DEFAULT_MAX_SEATS_PER_ORDER = 5000;

/** Plafond de licences par commande lu dans `envName` (entier > 0), sinon le défaut. */
export function maxSeatsFromEnv(envName) {
  const configured = Number(process.env[envName]);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_SEATS_PER_ORDER;
}

/** Entier strictement positif (9 chiffres au plus), sinon 400 avec `message`. */
export function parsePositiveInt(raw, message) {
  const text = String(raw ?? "").trim();
  if (!/^\d{1,9}$/.test(text) || Number(text) < 1) throw new BadRequestError(message);
  return Number(text);
}

/** Nombre de licences valide : entier entre 1 et `maxSeats`, sinon 400. */
export function parseSeats(raw, maxSeats) {
  const message = `Nombre de licences invalide : entre 1 et ${maxSeats} par commande.`;
  const seats = parsePositiveInt(raw, message);
  if (seats > maxSeats) throw new BadRequestError(message);
  return seats;
}

/**
 * Devis à la licence.
 * @param {{ basePrice: unknown, seats: number, breakpoint: object|null, label: string }} input
 *   `label` désigne le produit dans les messages d'erreur (« de la thématique », « du package »).
 */
export function priceLicences({ basePrice, seats, breakpoint, label }) {
  const baseCents = toCents(basePrice);
  if (baseCents <= 0n) {
    throw new AppError(`Prix de base ${label} invalide : contactez l'équipe commerciale.`, 409);
  }
  const discountBps = breakpoint ? rateToBasisPoints(breakpoint.discount_rate) : 0n;
  if (discountBps < 0n || discountBps >= 10000n) {
    throw new AppError("Palier de remise mal configuré : contactez l'équipe commerciale.", 409);
  }
  // Prix unitaire arrondi au centime (demi supérieur), puis multiplié : total exact.
  const unitCents = roundHalfUpDiv(baseCents * (10000n - discountBps), 10000n);
  const totalCents = unitCents * BigInt(seats);

  return {
    seats,
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

/** Code devise ISO 4217 (3 lettres), normalisé en majuscules ; sinon 409 (jamais de devise devinée). */
export function normalizeCurrency(raw, label) {
  const currency = String(raw ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new AppError(`Devise ${label} non configurée : contactez l'équipe commerciale.`, 409);
  }
  return currency;
}

// ─── Arithmétique décimale exacte ───────────────────────────────────────────

/** "15000.50" → 1500050n ; refuse tout ce qui n'est pas un décimal positif. */
export function toCents(value) {
  const text = String(value ?? "").trim();
  const match = /^(\d+)(?:\.(\d{1,}))?$/.exec(text);
  if (!match) return -1n;
  const frac = (match[2] || "").padEnd(3, "0");
  let cents = BigInt(match[1]) * 100n + BigInt(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) cents += 1n;
  return cents;
}

/** Taux décimal ("0.15", "0.1250") → points de base (1500n, 1250n). */
export function rateToBasisPoints(rate) {
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

export function centsToDecimal(cents) {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}

function basisPointsToRate(bps) {
  return `${bps / 10000n}.${String(bps % 10000n).padStart(4, "0")}`;
}
