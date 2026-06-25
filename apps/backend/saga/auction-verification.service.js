/**
 * AuctionVerificationService
 *
 * Implémente les 4 verrous métiers anti-fraude pour le flux d'enchères.
 * Chaque verrou est une barrière infranchissable : si un seul échoue,
 * le paiement est refusé avec une FraudDetectionException détaillée.
 *
 * Verrous :
 * V1 — PRIX : Montant en base vs montant déclaré
 * V2 — STATUT : Enchère dans un état 'ended' ou 'sold' non payé
 * V3 — IDENTITÉ : Email du payeur = email du gagnant
 * V4 — CASCADE : Rang du gagnant dans la cascade
 */
import { QueryTypes } from 'sequelize';
import sequelize from '../config/database.js';

/**
 * Exception levée quand un verrou anti-fraude est compromis.
 * Contient un code machine et un message explicite pour le logging.
 */
export class FraudDetectionException extends Error {
  /**
   * @param {string} code - Code machine (PRICE_MISMATCH, INVALID_STATUS, etc.)
   * @param {string} message - Description lisible de la fraude détectée
   * @param {Object} context - Données contextuelles pour le debugging
   */
  constructor(code, message, context = {}) {
    super(message);
    this.name = 'FraudDetectionException';
    this.code = code;
    this.context = context;
    this.severity = 'HIGH';
    this.timestamp = new Date().toISOString();
  }
}

export class AuctionVerificationService {
  /**
   * Point d'entrée unique : vérifie les 4 verrous pour une enchère.
   * Lance FraudDetectionException au premier verrou qui échoue.
   *
   * @param {number} auctionId - ID de l'enchère dans sl_auctions
   * @param {number} declaredAmount - Montant déclaré par le frontend
   * @param {string} customerEmail - Email de l'acheteur
   * @param {number|null} declaredRank - Rang déclaré (optionnel, pour cascade)
   * @returns {Promise<Object>} Données vérifiées de l'enchère
   */
  static async verifyAll(auctionId, declaredAmount, customerEmail, declaredRank = null) {
    const auction = await this.loadAuctionWithWinner(auctionId);

    // Exécution séquentielle des 4 verrous
    this.verifyPrice(auction, declaredAmount);
    await this.verifyStatus(auction);
    await this.verifyIdentity(auction, customerEmail);
    this.verifyCascade(auction, declaredRank);

    return auction;
  }

  /**
   * Charge l'enchère avec les informations du gagnant en une seule requête
   */
  static async loadAuctionWithWinner(auctionId) {
    const [auction] = await sequelize.query(
      `SELECT
        a.id, a.formation_id, a.title, a.description,
        a.starting_price, a.current_price, a.buy_now_price,
        a.status, a.payment_status,
        a.highest_bidder_id, a.winner_id, a.winning_bid_id,
        a.final_price, a.current_winner_rank,
        a.start_date, a.end_date, a.cascade_deadline,
        a.created_at, a.updated_at,
        au.email AS winner_email,
        au.first_name AS winner_first_name,
        au.last_name AS winner_last_name
      FROM sl_auctions a
      LEFT JOIN sl_auction_users au ON a.winner_id = au.id
      WHERE a.id = :auctionId`,
      {
        replacements: { auctionId },
        type: QueryTypes.SELECT,
      }
    );

    if (!auction) {
      throw new FraudDetectionException(
        'AUCTION_NOT_FOUND',
        `Enchère #${auctionId} introuvable dans la base de données.`,
        { auctionId }
      );
    }

    return auction;
  }

  /**
   * V1 — VERROU PRIX
   * Vérifie que le montant déclaré correspond exactement au current_price en base.
   * Protège contre la modification du montant dans la requête HTTP.
   */
  static verifyPrice(auction, declaredAmount) {
    const expectedPrice = Number(auction.current_price);
    const receivedAmount = Number(declaredAmount);

    // Tolérance de 0.01 pour les erreurs d'arrondi
    if (Math.abs(expectedPrice - receivedAmount) > 0.01) {
      throw new FraudDetectionException(
        'PRICE_MISMATCH',
        `Tentative de fraude : le montant déclaré (${receivedAmount}) ne correspond pas ` +
        `au prix final de l'enchère #${auction.id} (${expectedPrice}).`,
        {
          auctionId: auction.id,
          expectedPrice,
          receivedAmount,
          difference: receivedAmount - expectedPrice,
        }
      );
    }
  }

  /**
   * V2 — VERROU STATUT
   * Vérifie que l'enchère peut être payée (ended ou sold non payé).
   */
  static async verifyStatus(auction) {
    // Cas 1 : Enchère encore active → refus
    if (auction.status === 'active') {
      throw new FraudDetectionException(
        'AUCTION_STILL_ACTIVE',
        `L'enchère #${auction.id} est encore active (status=active). ` +
        `Elle doit être terminée avant de pouvoir être payée.`,
        { auctionId: auction.id, status: auction.status }
      );
    }

    // Cas 2 : Enchère annulée → refus
    if (auction.status === 'cancelled' || auction.status === 'draft' || auction.status === 'scheduled') {
      throw new FraudDetectionException(
        'AUCTION_NOT_PAYABLE',
        `L'enchère #${auction.id} a le statut "${auction.status}" et ne peut pas être payée.`,
        { auctionId: auction.id, status: auction.status }
      );
    }

    // Cas 3 : Enchère déjà soldée et payée → refus
    if (auction.status === 'sold' && auction.payment_status === 'paid') {
      throw new FraudDetectionException(
        'AUCTION_ALREADY_PAID',
        `L'enchère #${auction.id} a déjà été payée (payment_status=paid). ` +
        `Tentative de double paiement détectée.`,
        {
          auctionId: auction.id,
          status: auction.status,
          paymentStatus: auction.payment_status,
          finalPrice: auction.final_price,
        }
      );
    }

    // Cas 4 : Cascade expirée → refus
    if (auction.status === 'ended' && auction.cascade_deadline) {
      const now = new Date();
      const deadline = new Date(auction.cascade_deadline);
      if (now > deadline) {
        throw new FraudDetectionException(
          'CASCADE_EXPIRED',
          `Le délai de cascade pour l'enchère #${auction.id} est expiré ` +
          `(deadline: ${deadline.toISOString()}).`,
          {
            auctionId: auction.id,
            cascadeDeadline: auction.cascade_deadline,
            currentTime: now.toISOString(),
          }
        );
      }
    }

    // Statut valide
    const validStatuses = ['ended', 'sold'];
    if (!validStatuses.includes(auction.status)) {
      throw new FraudDetectionException(
        'INVALID_AUCTION_STATUS',
        `L'enchère #${auction.id} a un statut invalide "${auction.status}". ` +
        `Statuts attendus : ${validStatuses.join(', ')}.`,
        { auctionId: auction.id, status: auction.status, validStatuses }
      );
    }
  }

  /**
   * V3 — VERROU IDENTITÉ
   * Vérifie que l'email de l'acheteur correspond au gagnant de l'enchère.
   * Empêche le vol d'enchère (un tiers ne peut pas payer à la place du gagnant).
   */
  static async verifyIdentity(auction, customerEmail) {
    if (!auction.winner_email) {
      throw new FraudDetectionException(
        'NO_WINNER_DEFINED',
        `L'enchère #${auction.id} n'a pas de gagnant défini (winner_id ou winner_email est NULL).`,
        { auctionId: auction.id, winnerId: auction.winner_id }
      );
    }

    if (auction.winner_email.toLowerCase() !== customerEmail.toLowerCase()) {
      // Vérifier si cet email fait partie de la cascade
      const isCascadeCandidate = await this.isCascadeParticipant(auction.id, customerEmail);

      if (!isCascadeCandidate) {
        throw new FraudDetectionException(
          'IDENTITY_MISMATCH',
          `Tentative de vol d'enchère : l'email "${customerEmail}" ne correspond ni au gagnant ` +
          `("${auction.winner_email}") ni à aucun participant de la cascade pour l'enchère #${auction.id}.`,
          {
            auctionId: auction.id,
            winnerEmail: auction.winner_email,
            attemptedEmail: customerEmail,
          }
        );
      }
    }
  }

  /**
   * V4 — VERROU CASCADE
   * Vérifie que le rang déclaré correspond au current_winner_rank.
   * Un joueur ne peut pas sauter les rangs dans la file d'attente.
   */
  static verifyCascade(auction, declaredRank) {
    if (declaredRank === null || declaredRank === undefined) {
      // Si aucun rang n'est déclaré, on laisse passer (les enchères simples n'ont pas de cascade)
      return;
    }

    const expectedRank = auction.current_winner_rank || 1;

    if (Number(declaredRank) !== Number(expectedRank)) {
      throw new FraudDetectionException(
        'CASCADE_RANK_MISMATCH',
        `Tentative de fraude : le rang déclaré (${declaredRank}) ne correspond pas ` +
        `au rang attendu (${expectedRank}) pour l'enchère #${auction.id}.`,
        {
          auctionId: auction.id,
          declaredRank: Number(declaredRank),
          expectedRank: Number(expectedRank),
        }
      );
    }
  }

  /**
   * Vérifie si un email correspond à un participant de la cascade
   * (quelqu'un qui a enchéri mais n'a pas gagné)
   */
  static async isCascadeParticipant(auctionId, email) {
    const [result] = await sequelize.query(
      `SELECT COUNT(DISTINCT au.id) AS count
       FROM sl_auction_users au
       INNER JOIN sl_auction_bids b ON b.user_id = au.id
       WHERE b.auction_id = :auctionId
         AND LOWER(au.email) = LOWER(:email)`,
      {
        replacements: { auctionId, email },
        type: QueryTypes.SELECT,
      }
    );

    return result && Number(result.count) > 0;
  }
}