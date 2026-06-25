/**
 * PricingService
 *
 * Calcule les prix avec remise volumétrique pour les packages B2B.
 * Lit dynamiquement les paliers depuis la table sl_volume_breakpoints
 * configurée par le super admin.
 */
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';

export class PricingService {
  /**
   * Calcule le prix total avec remise pour un nombre de sièges donné
   *
   * @param {number} packageId - ID du package dans sl_formation_packages
   * @param {number} seatCount - Nombre de sièges à acheter
   * @returns {Promise<Object>} Résultat du calcul
   */
  static async calculate(packageId, seatCount) {
    // 1. Récupérer le prix de base du package
    const pkg = await this.getPackage(packageId);
    if (!pkg) {
      throw new PricingError('PACKAGE_NOT_FOUND', `Package #${packageId} introuvable.`);
    }

    const basePrice = Number(pkg.price);
    if (basePrice <= 0) {
      throw new PricingError('INVALID_PRICE', `Le package #${packageId} a un prix invalide.`);
    }

    // 2. Trouver le palier applicable
    const breakpoint = await this.findApplicableBreakpoint(seatCount);

    // 3. Calculer le prix
    const discountRate = breakpoint ? Number(breakpoint.discount_rate) : 0;
    const unitPrice = basePrice * (1 - discountRate);
    const totalPrice = unitPrice * seatCount;

    return {
      packageId,
      packageTitle: pkg.title,
      basePrice,
      seatCount,
      discountRate,
      discountLabel: breakpoint ? breakpoint.label : '-',
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      currency: pkg.currency || 'EUR',
      appliedBreakpoint: breakpoint ? {
        id: breakpoint.id,
        label: breakpoint.label,
        minSeats: breakpoint.min_seats,
        maxSeats: breakpoint.max_seats,
      } : null,
    };
  }

  /**
   * Récupère un package avec son prix de base
   */
  static async getPackage(packageId) {
    const [pkg] = await sequelize.query(
      `SELECT id, title, price, currency FROM sl_formation_packages WHERE id = :id LIMIT 1`,
      {
        replacements: { id: Number(packageId) },
        type: QueryTypes.SELECT,
      }
    );
    return pkg || null;
  }

  /**
   * Trouve le palier applicable pour un nombre de sièges donné.
   * Lit depuis sl_volume_breakpoints configuré par le super admin.
   */
  static async findApplicableBreakpoint(seatCount) {
    if (seatCount <= 1) return null; // Pas de remise pour 1 siège

    const [breakpoint] = await sequelize.query(
      `SELECT * FROM sl_volume_breakpoints
       WHERE is_active = TRUE
         AND min_seats <= :seatCount
         AND (max_seats IS NULL OR max_seats >= :seatCount)
       ORDER BY display_order DESC
       LIMIT 1`,
      {
        replacements: { seatCount },
        type: QueryTypes.SELECT,
      }
    );

    return breakpoint || null;
  }

  /**
   * Retourne la grille complète des paliers pour affichage
   */
  static async getBreakpointGrid(packageId) {
    const pkg = await this.getPackage(packageId);
    if (!pkg) return [];

    const basePrice = Number(pkg.price);
    const breakpoints = await sequelize.query(
      `SELECT * FROM sl_volume_breakpoints WHERE is_active = TRUE ORDER BY display_order ASC`,
      { type: QueryTypes.SELECT }
    );

    const grid = [];

    // 1 siège (pas de remise)
    grid.push({
      minSeats: 1,
      maxSeats: 1,
      label: '-',
      unitPrice: basePrice,
      totalPrice: basePrice,
    });

    for (const bp of breakpoints) {
      grid.push({
        minSeats: bp.min_seats,
        maxSeats: bp.max_seats || '∞',
        label: bp.label,
        discountRate: Number(bp.discount_rate),
        unitPrice: Math.round(basePrice * (1 - Number(bp.discount_rate)) * 100) / 100,
        totalPrice: Math.round(basePrice * (1 - Number(bp.discount_rate)) * bp.min_seats * 100) / 100,
      });
    }

    return grid;
  }
}

export class PricingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PricingError';
    this.code = code;
  }
}