import { agree, purchaseWords } from "../utils/purchase-labels.js";
import { Sequelize, Op } from "sequelize";
import { Order } from "../models/index.js";
import { OrderStatus } from "../enums/index.js";
import { OrderAuditService } from "../services/order-audit.service.js";
import { MailService } from "../services/mail.service.js";
import sequelize from "../config/database.js";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../utils/errors.js";

/**
 * OrderController - Gestion du cycle de vie des inscriptions LMS
 *
 * Endpoints pour:
 * - Validation admin
 * - Finalisation (envoi credentials)
 * - Historique/audit
 */
export class OrderController {
  /**
   * GET /api/admin/orders
   * Liste des inscriptions avec filtres
   */
  static async list(req, res, next) {
    try {
      const {
        status,
        purchaseType,
        formationId,
        search,
        dateFrom,
        dateTo,
        page = 1,
        limit = 50,
        lmsItemType,
      } = req.query;

      const where = {};

      // Filtres
      if (status) where.status = status;
      if (purchaseType) where.purchaseType = purchaseType;
      if (formationId) where.formationId = formationId;
      if (lmsItemType) where.lmsItemType = lmsItemType;

      // Recherche
      if (search) {
        where[Op.or] = [
          { reference: { [Op.like]: `%${search}%` } },
          { customerEmail: { [Op.like]: `%${search}%` } },
          { customerName: { [Op.like]: `%${search}%` } },
        ];
      }

      // Dates
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom)
          where.createdAt[Op.gte] = new Date(dateFrom);
        if (dateTo)
          where.createdAt[Op.lte] = new Date(dateTo);
      }

      const { count, rows } = await Order.findAndCountAll({
        where,
        order: [[sequelize.col("created_at"), "DESC"]],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      res.json({
        success: true,
        data: rows,
        meta: {
          total: count,
          page: parseInt(page),
          perPage: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/orders/:id
   * Détail d'une inscription avec historique d'audit
   */
  static async getById(req, res, next) {
    try {
      const { id } = req.params;

      const order = await Order.findByPk(id);

      if (!order) {
        throw new NotFoundError("Achat introuvable.");
      }

      // Récupérer l'historique d'audit
      const auditHistory = await OrderAuditService.getOrderHistory(order.id);

      res.json({
        success: true,
        data: {
          order,
          auditHistory,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/orders/:id/validate
   * Valider ou rejeter une inscription
   *
   * Action: validate -> Envoie facture + passe en VALIDATED
   * Action: reject -> Passe en REJECTED + notifie client
   */
  static async validate(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const { action, notes } = req.body;

      // Validations
      if (!action || !["validate", "reject"].includes(action)) {
        throw new BadRequestError(
          "Action invalide. Utilisez 'validate' ou 'reject'",
        );
      }

      const order = await Order.findByPk(id, { transaction });

      if (!order) {
        throw new NotFoundError("Achat introuvable.");
      }

      // Vérifier que l’inscription est en attente de validation
      if (order.status !== OrderStatus.PAYMENT_CONFIRMED) {
        throw new BadRequestError(
          `Validation impossible dans l’état actuel (${order.status}).`,
        );
      }

      const previousState = { status: order.status };

      // Déterminer le(s) destinataire(s) pour l'audit
      const recipients =
        order.purchaseType === "gift"
          ? `${order.customerEmail} (Acheteur) & ${order.beneficiaryEmail} (Bénéficiaire)`
          : order.customerEmail;

      if (action === "validate") {
        // === VALIDATION ===
        await order.update(
          {
            status: OrderStatus.VALIDATED,
            validatedAt: new Date(),
            validatedBy: req.pspAdmin?.id ?? 0,
            adminNotes: notes || null,
          },
          { transaction },
        );

        // Envoyer email avec FACTURE (automatique)
        await MailService.sendOrderValidated(order);

        console.log(
          `[OrderController] Order validated & invoice sent to: ${recipients}`,
        );

        // Log audit
        await OrderAuditService.logAdminAction({
          orderId: order.id,
          orderReference: order.reference,
          action: "ORDER_VALIDATED",
          actorId: req.pspAdmin?.id ?? null,
          actorEmail: req.adminIdentifier,
          previousState,
          newState: {
            status: OrderStatus.VALIDATED,
            validatedAt: new Date(),
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          emailSentTo: recipients,
        });

        await transaction.commit();

        res.json({
          success: true,
          message: `${purchaseWords(order).Noun} ${agree(purchaseWords(order), "validé")} : facture envoyée par e-mail.`,
          data: { order },
        });
      } else {
        // === REJET ===
        await order.update(
          {
            status: OrderStatus.REJECTED,
            validatedAt: new Date(),
            validatedBy: req.pspAdmin?.id ?? 0,
            rejectionReason: notes || "Rejetée par l'admin",
          },
          { transaction },
        );

        // Envoyer email de rejet
        await MailService.sendOrderRejected(order);

        console.log(
          `[OrderController] Rejection email sent to: ${order.customerEmail}`,
        );

        // Log audit
        await OrderAuditService.logAdminAction({
          orderId: order.id,
          orderReference: order.reference,
          action: "ORDER_REJECTED",
          actorId: req.pspAdmin?.id ?? null,
          actorEmail: req.adminIdentifier,
          previousState,
          newState: {
            status: OrderStatus.REJECTED,
            rejectionReason: notes,
          },
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          emailSentTo: order.customerEmail,
        });

        await transaction.commit();

        res.json({
          success: true,
          message: "Refus enregistré : le client est prévenu.",
          data: { order },
        });
      }
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  /**
   * POST /api/admin/orders/:id/complete
   * Finaliser une inscription - envoyer credentials
   */
  static async complete(req, res, next) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const { username, password } = req.body;

      // Validations
      if (!username || !password) {
        throw new BadRequestError("Username et password requis");
      }

      const order = await Order.findByPk(id, { transaction });

      if (!order) {
        throw new NotFoundError("Achat introuvable.");
      }

      // Vérifier que l’inscription est validée
      if (order.status !== OrderStatus.VALIDATED) {
        throw new BadRequestError(
          `Finalisation impossible dans l’état actuel (${order.status}).`,
        );
      }

      const previousState = { status: order.status };

      // Déterminer le(s) destinataire(s) pour l'audit
      const recipients =
        order.purchaseType === "gift"
          ? `${order.customerEmail} (Acheteur) & ${order.beneficiaryEmail} (Bénéficiaire)`
          : order.customerEmail;

      // Mettre à jour l’inscription
      await order.update(
        {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
          completedBy: req.pspAdmin?.id ?? 0,
          campusUsername: username,
          credentialsSentAt: new Date(),
          credentialsSentTo: recipients,
        },
        { transaction },
      );

      // Envoyer email avec credentials + facture
      await MailService.sendOrderCompleted(order, { username, password });

      console.log(
        `[OrderController] Credentials sent to: ${recipients}`,
      );

      // Log audit
      await OrderAuditService.logAdminAction({
        orderId: order.id,
        orderReference: order.reference,
        action: "ORDER_COMPLETED",
        actorId: req.pspAdmin?.id ?? null,
        actorEmail: req.adminIdentifier,
        previousState,
        newState: {
          status: OrderStatus.COMPLETED,
          campusUsername: username,
          completedAt: new Date(),
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        emailSentTo: recipients,
      });

      await transaction.commit();

      res.json({
        success: true,
        message: "Accès envoyés au client : achat finalisé.",
        data: { order },
      });
    } catch (error) {
      await transaction.rollback();
      next(error);
    }
  }

  /**
   * GET /api/admin/orders/:id/audit
   * Historique d'audit d'une inscription
   */
  static async getAuditHistory(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const order = await Order.findByPk(id);

      if (!order) {
        throw new NotFoundError("Achat introuvable.");
      }

      const auditLogs = await OrderAuditService.getOrderHistory(order.id, {
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      res.json({
        success: true,
        data: auditLogs,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default OrderController;
