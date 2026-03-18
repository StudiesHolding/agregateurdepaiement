import { Order, Company, CompanyPackage, FormationPackage, sequelize } from "../models/index.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";
import { InvoiceService } from "../services/invoice.service.js";
import { OrchestratorService } from "../services/orchestrator.service.js";

export const b2bOrderController = {
  /**
   * @route GET /api/v1/b2b/orders
   * @desc Get all orders for the company
   */
  getAll: async (req, res, next) => {
    try {
      const companyId = req.company_id;

      // Get all orders and filter by company_id in metadata
      const allOrders = await Order.findAll({
        order: [['created_at', 'DESC']],
        limit: 100
      });

      // Filter orders that belong to this company via metadata
      const companyOrders = allOrders.filter(order => {
        const metadata = order.metadata || {};
        return metadata.company_id === companyId;
      });

      // Enrich with formation data
      const enrichedOrders = await Promise.all(companyOrders.map(async (order) => {
        let formationPackage = null;
        if (order.formationId && order.lmsItemType === 'package') {
          formationPackage = await FormationPackage.findByPk(order.formationId);
        }
        return {
          id: order.id,
          reference: order.reference,
          customerEmail: order.customerEmail,
          customerName: order.customerName,
          currency: order.currency,
          totalAmount: order.totalAmount,
          status: order.status,
          lmsItemType: order.lmsItemType,
          formationId: order.formationId,
          formationName: order.formationName,
          formationPrice: order.formationPrice,
          paidAt: order.paidAt,
          paymentProvider: order.paymentProvider,
          paymentIntentId: order.paymentIntentId,
          metadata: order.metadata,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          formationPackage: formationPackage ? {
            id: formationPackage.id,
            title: formationPackage.title,
            description: formationPackage.description,
            price: formationPackage.price,
            currency: formationPackage.currency
          } : null
        };
      }));

      res.json({
        status: "success",
        data: enrichedOrders
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route GET /api/v1/b2b/orders/:id
   * @desc Get order details
   */
  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const companyId = req.company_id;

      const order = await Order.findByPk(id);

      if (!order) {
        throw new NotFoundError("Commande introuvable.");
      }

      // Verify ownership
      const metadata = order.metadata || {};
      if (metadata.company_id !== companyId) {
        throw new NotFoundError("Commande introuvable.");
      }

      // Get formation package info
      let formationPackage = null;
      if (order.formationId && order.lmsItemType === 'package') {
        formationPackage = await FormationPackage.findByPk(order.formationId);
      }

      res.json({
        status: "success",
        data: {
          id: order.id,
          reference: order.reference,
          customerEmail: order.customerEmail,
          customerName: order.customerName,
          currency: order.currency,
          totalAmount: order.totalAmount,
          status: order.status,
          lmsItemType: order.lmsItemType,
          formationId: order.formationId,
          formationName: order.formationName,
          formationPrice: order.formationPrice,
          paidAt: order.paidAt,
          paymentProvider: order.paymentProvider,
          paymentIntentId: order.paymentIntentId,
          metadata: order.metadata,
          createdAt: order.createdAt,
          formationPackage: formationPackage ? {
            id: formationPackage.id,
            title: formationPackage.title,
            description: formationPackage.description,
            price: formationPackage.price,
            currency: formationPackage.currency
          } : null
        }
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route GET /api/v1/b2b/orders/:id/invoice
   * @desc Download invoice PDF
   */
  getInvoice: async (req, res, next) => {
    try {
      const { id } = req.params;
      const companyId = req.company_id;

      const order = await Order.findByPk(id);

      if (!order) {
        throw new NotFoundError("Commande introuvable.");
      }

      // Verify ownership
      const metadata = order.metadata || {};
      if (metadata.company_id !== companyId) {
        throw new NotFoundError("Commande introuvable.");
      }

      if (order.status !== 'completed' && order.status !== 'paid') {
        throw new BadRequestError("La facture n'est disponible que pour les commandes payées.");
      }

      // Generate PDF
      const pdfBuffer = await InvoiceService.generateInvoiceBuffer(null, order);

      if (!pdfBuffer) {
        throw new Error("Erreur lors de la génération de la facture.");
      }

      // Send PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="facture-${order.reference}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route POST /api/v1/b2b/orders/initiate-payment
   * @desc Initiate payment using the intelligent payment orchestrator
   * Uses CinetPay/KKiaPay/Stripe with automatic fallback
   */
  initiatePayment: async (req, res, next) => {
    try {
      const { package_id, total_licenses, paymentMethod, countryCode, currency } = req.body;
      const companyId = req.company_id;
      const companyEmail = req.company_email;
      const companyName = req.company_name;

      // 1. Get package details
      const pkg = await FormationPackage.findByPk(package_id);
      if (!pkg) {
        throw new NotFoundError("Package introuvable.");
      }

      // 2. Calculate price
      const unitPrice = Number(pkg.price) || 0;
      const totalAmount = unitPrice * total_licenses;

      if (totalAmount <= 0) {
        throw new BadRequestError("Prix invalide pour ce package.");
      }

      // 3. Prepare payment data for the orchestrator
      const paymentData = {
        customerEmail: companyEmail,
        customerName: companyName,
        lmsItemId: package_id.toString(),
        lmsItemType: 'package',
        paymentMethod: paymentMethod || 'card', // card, mobile_money
        countryCode: countryCode || 'CM',
        currency: currency || pkg.currency || 'XOF',
        amount: totalAmount,
        successUrl: `${process.env.FRONTEND_URL || 'http://localhost:3002'}/fr/dashboard/packages?payment=success`,
        cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3002'}/fr/dashboard/catalog?payment=cancelled`,
        failedUrl: `${process.env.FRONTEND_URL || 'http://localhost:3002'}/fr/dashboard/catalog?payment=failed`,
        metadata: {
          is_b2b: true,
          b2b_purchase: true,
          company_id: companyId,
          company_name: companyName,
          company_admin_email: companyEmail,
          licence_count: total_licenses,
          unit_price: unitPrice,
          source: 'b2b_dashboard'
        }
      };

      console.log('[B2BOrderController] Initiating payment with orchestrator:', paymentData);

      // 4. Call the intelligent payment orchestrator
      const result = await OrchestratorService.initializePayment(paymentData);

      if (!result.success) {
        throw new BadRequestError(result.error || "Erreur lors de l'initialisation du paiement.");
      }

      res.status(201).json({
        status: "success",
        data: {
          orderReference: result.orderReference,
          paymentIntentId: result.paymentIntentId,
          redirectUrl: result.redirectUrl,
          widgetParams: result.widgetParams,
          provider: result.provider,
          clientSecret: result.clientSecret,
          amount: totalAmount,
          currency: currency || pkg.currency || 'XOF',
          licences: total_licenses
        }
      });
    } catch (err) {
      next(err);
    }
  }
};
