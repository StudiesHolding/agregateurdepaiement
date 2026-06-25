/**
 * LegacyStrategy
 *
 * Stratégie pour les achats RETAIL et AUCTION legacy (LearnPress).
 * Utilise les connexions directes à MariaDB (même base que WordPress).
 *
 * Flux :
 * 1. Vérifier/créer le compte kyd4_users
 * 2. Inscrire dans kyd4_learnpress_user_items
 * 3. Si AUCTION : mettre à jour le statut de l'enchère
 * 4. Marquer la commande comme COMPLETED
 * 5. Envoyer l'email de confirmation
 */
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { Order, sequelize as db } from '../../models/index.js';
import { OrderStatus } from '../../enums/index.js';
import { MailService } from '../../services/mail.service.js';
import { AuctionVerificationService } from '../auction-verification.service.js';
import crypto from 'crypto';

export class LegacyStrategy {
  /**
   * Exécute la stratégie pour un événement RETAIL ou AUCTION
   * @param {Object} event - Événement de la queue
   * @returns {Promise<Object>}
   */
  async execute(event) {
    const { payload, correlationId, source } = event;
    const { customerEmail, customerName, customerSurname, formationId, orderReference } = payload;

    console.log(`[LegacyStrategy:${correlationId}] Starting for order ${orderReference}`);

    // Si AUCTION : exécuter les 4 verrous anti-fraude
    if (source === 'AUCTION') {
      await AuctionVerificationService.verifyAll(
        payload.auctionId,
        payload.amount,
        customerEmail,
        payload.declaredRank || null
      );
    }

    // Utiliser une transaction MariaDB pour tout l'enrollment
    const transaction = await db.transaction();

    try {
      // 1. Trouver ou créer le compte student dans kyd4_users
      const userId = await this.findOrCreateUser(
        customerEmail, customerName, customerSurname, transaction
      );

      // 2. Inscrire l'utilisateur dans la formation (LearnPress)
      await this.enrollInFormation(userId, formationId, transaction);

      // 3. Si AUCTION : mettre à jour le statut de l'enchère
      if (source === 'AUCTION') {
        await this.updateAuctionStatus(payload, transaction);
      }

      // 4. Marquer la commande comme COMPLETED
      await Order.update(
        {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
        },
        { where: { reference: orderReference }, transaction }
      );

      await transaction.commit();

      // 5. Email de confirmation (après commit)
      await MailService.sendPaymentConfirmed({
        reference: orderReference,
        customerEmail,
        customerName,
        formationName: payload.formationName || 'Formation',
        source,
      });

      console.log(`[LegacyStrategy:${correlationId}] ✅ Order ${orderReference} completed`);

      return {
        success: true,
        orderReference,
        userId,
        details: { enrollmentId: crypto.randomUUID() },
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Trouve ou crée un compte utilisateur dans kyd4_users
   */
  async findOrCreateUser(email, firstName, lastName, transaction) {
    const [existing] = await sequelize.query(
      `SELECT ID FROM kyd4_users WHERE user_email = :email LIMIT 1`,
      {
        replacements: { email },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    if (existing) {
      return Number(existing.ID);
    }

    // Créer l'utilisateur dans WordPress
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_')
      + '_' + crypto.randomBytes(4).toString('hex');
    const password = crypto.randomBytes(24).toString('hex');
    const now = new Date();

    const [result] = await sequelize.query(
      `INSERT INTO kyd4_users
       (user_login, user_pass, user_nicename, user_email, display_name, user_registered)
       VALUES (:username, :password, :nicename, :email, :displayName, :now)`,
      {
        replacements: {
          username,
          password: crypto.createHash('md5').update(password).digest('hex'),
          nicename: `${firstName} ${lastName}`.toLowerCase().replace(/\s+/g, '-'),
          email,
          displayName: `${firstName} ${lastName}`,
          now,
        },
        type: QueryTypes.INSERT,
        transaction,
      }
    );

    console.log(`[LegacyStrategy] Created kyd4_users ID=${result} for ${email}`);
    return Number(result);
  }

  /**
   * Inscrit un utilisateur à une formation dans LearnPress
   */
  async enrollInFormation(userId, formationId, transaction) {
    // Vérifier si déjà inscrit (idempotence)
    const [existing] = await sequelize.query(
      `SELECT user_item_id FROM kyd4_learnpress_user_items
       WHERE user_id = :userId AND item_id = :itemId AND item_type = 'lp_course'
       LIMIT 1`,
      {
        replacements: { userId, itemId: Number(formationId) },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    if (existing) {
      console.log(`[LegacyStrategy] User ${userId} already enrolled in formation ${formationId}`);
      return;
    }

    await sequelize.query(
      `INSERT INTO kyd4_learnpress_user_items
       (user_id, item_id, start_time, item_type, status, access_level)
       VALUES (:userId, :itemId, NOW(), 'lp_course', 'enrolled', 50)`,
      {
        replacements: { userId, itemId: Number(formationId) },
        type: QueryTypes.INSERT,
        transaction,
      }
    );

    console.log(`[LegacyStrategy] Enrolled user ${userId} in formation ${formationId}`);
  }

  /**
   * Met à jour le statut de l'enchère après paiement
   */
  async updateAuctionStatus(payload, transaction) {
    const { auctionId, finalPrice, winnerId, bidId } = payload;

    await sequelize.query(
      `UPDATE sl_auctions
       SET status = 'sold',
           final_price = :finalPrice,
           winner_id = :winnerId,
           winning_bid_id = :bidId,
           payment_status = 'paid'
       WHERE id = :auctionId`,
      {
        replacements: {
          auctionId,
          finalPrice: finalPrice || 0,
          winnerId: winnerId || null,
          bidId: bidId || null,
        },
        type: QueryTypes.UPDATE,
        transaction,
      }
    );

    console.log(`[LegacyStrategy] Auction #${auctionId} marked as sold`);
  }
}