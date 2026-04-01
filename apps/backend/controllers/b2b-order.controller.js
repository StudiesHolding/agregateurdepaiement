import {
  Order,
  Company,
  CompanyPackage,
  FormationPackage,
  sequelize,
} from "../models/index.js";
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
      console.log("[B2B GET ORDERS] companyId from req:", companyId);

      let companyEmail = null;
      let companyName = null;

      if (companyId) {
        const company = await Company.findByPk(companyId);
        companyEmail = company?.email;
        companyName = company?.name;
        console.log("[B2B GET ORDERS] Company found:", {
          companyId,
          companyEmail,
          companyName,
        });
      } else {
        console.log("[B2B GET ORDERS] WARNING: No companyId in request!");
      }

      // Get all orders
      const allOrders = await Order.findAll({
        order: [["created_at", "DESC"]],
        limit: 100,
      });
      console.log("[B2B GET ORDERS] Total orders in DB:", allOrders.length);

      // Debug: Log metadata for first few orders
      if (allOrders.length > 0) {
        console.log("[B2B GET ORDERS] Sample order metadata:");
        allOrders.slice(0, 3).forEach((o, i) => {
          console.log(
            `  Order ${i + 1}:`,
            o.reference,
            "metadata:",
            JSON.stringify(o.metadata).substring(0, 200),
          );
        });
      }

      // Filter orders that belong to this company via multiple criteria:
      // 1. metadata.company_id (handle both string and integer)
      // 2. customer_email matching company email
      // 3. customer_name matching company name
      // 4. metadata.company_name matching company name
      const companyOrders = allOrders.filter((order) => {
        // Parse metadata if it's a string (MySQL JSON stored as string)
        let metadata = order.metadata || {};
        if (typeof metadata === "string") {
          try {
            metadata = JSON.parse(metadata);
          } catch (e) {
            metadata = {};
          }
        }

        // Check company_id in metadata (handle string/int comparison)
        const metaCompanyId = metadata.company_id;
        const matchesCompanyId =
          metaCompanyId !== undefined &&
          (String(metaCompanyId) === String(companyId) ||
            metaCompanyId === companyId);

        // Check customer_email matches company email
        const matchesEmail =
          companyEmail && order.customerEmail === companyEmail;

        // Check customer_name matches company name
        const matchesName = companyName && order.customerName === companyName;

        // Check metadata.company_name
        const matchesMetaName =
          metadata.company_name &&
          metadata.company_name.toLowerCase() === companyName?.toLowerCase();

        // Check if it's a B2B order with company info
        const isB2BOrder =
          metadata.is_b2b === true || metadata.b2b_purchase === true;

        // Debug log for each order
        if (isB2BOrder) {
          console.log("[B2B GET ORDERS] B2B Order:", order.reference, {
            orderEmail: order.customerEmail,
            orderName: order.customerName,
            metaCompanyId,
            companyId,
            companyEmail,
            companyName,
            matchesCompanyId,
            matchesEmail,
            matchesName,
            matchesMetaName,
          });
        }

        return (
          isB2BOrder &&
          (matchesCompanyId || matchesEmail || matchesName || matchesMetaName)
        );
      });

      console.log(
        "[B2B GET ORDERS] Filtered orders count:",
        companyOrders.length,
      );

      // Enrich with formation data
      const enrichedOrders = await Promise.all(
        companyOrders.map(async (order) => {
          let formationPackage = null;
          if (order.formationId && order.lmsItemType === "package") {
            formationPackage = await FormationPackage.findByPk(
              order.formationId,
            );
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
            formationPackage: formationPackage
              ? {
                  id: formationPackage.id,
                  title: formationPackage.name,
                  description: formationPackage.description,
                  price: formationPackage.price,
                  currency: formationPackage.currency,
                }
              : null,
          };
        }),
      );

      res.json({
        status: "success",
        data: enrichedOrders,
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
      if (order.formationId && order.lmsItemType === "package") {
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
          formationPackage: formationPackage
            ? {
                id: formationPackage.id,
                title: formationPackage.title,
                description: formationPackage.description,
                price: formationPackage.price,
                currency: formationPackage.currency,
              }
            : null,
        },
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
      const company = await Company.findByPk(companyId);
      const companyEmail = company?.email;
      const companyName = company?.name;

      const order = await Order.findByPk(id);

      if (!order) {
        throw new NotFoundError("Commande introuvable.");
      }

      // Parse metadata if string
      let metadata = order.metadata || {};
      if (typeof metadata === "string") {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }

      // Verify ownership - check multiple criteria
      const metaCompanyId = metadata.company_id;
      const matchesCompanyId =
        metaCompanyId !== undefined &&
        (String(metaCompanyId) === String(companyId) ||
          metaCompanyId === companyId);
      const matchesEmail = companyEmail && order.customerEmail === companyEmail;
      const matchesName = companyName && order.customerName === companyName;
      const matchesMetaName =
        metadata.company_name &&
        metadata.company_name.toLowerCase() === companyName?.toLowerCase();
      const isB2BOrder =
        metadata.is_b2b === true || metadata.b2b_purchase === true;

      if (
        !isB2BOrder ||
        !(matchesCompanyId || matchesEmail || matchesName || matchesMetaName)
      ) {
        throw new NotFoundError("Commande introuvable.");
      }

      if (
        order.status !== "completed" &&
        order.status !== "paid" &&
        order.status !== "validated"
      ) {
        throw new BadRequestError(
          "La facture n'est disponible que pour les commandes validées ou payées.",
        );
      }

      // Generate PDF
      const pdfBuffer = await InvoiceService.generateInvoiceBuffer(null, order);

      if (!pdfBuffer) {
        throw new Error("Erreur lors de la génération de la facture.");
      }

      // Send PDF
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="facture-${order.reference}.pdf"`,
      );
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
      const {
        package_id,
        total_licenses,
        paymentMethod,
        countryCode,
        currency,
      } = req.body;
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
        lmsItemType: "package",
        paymentMethod: paymentMethod || "card", // card, mobile_money
        countryCode: countryCode || "CM",
        currency: currency || pkg.currency || "XOF",
        amount: totalAmount,
        successUrl: `${process.env.FRONTEND_URL || "http://localhost:3002"}/fr/dashboard/packages?payment=success`,
        cancelUrl: `${process.env.FRONTEND_URL || "http://localhost:3002"}/fr/dashboard/catalog?payment=cancelled`,
        failedUrl: `${process.env.FRONTEND_URL || "http://localhost:3002"}/fr/dashboard/catalog?payment=failed`,
        metadata: {
          is_b2b: true,
          b2b_purchase: true,
          company_id: companyId,
          company_name: companyName,
          company_admin_email: companyEmail,
          licence_count: total_licenses,
          unit_price: unitPrice,
          source: "b2b_dashboard",
        },
      };

      console.log(
        "[B2BOrderController] Initiating payment with orchestrator:",
        paymentData,
      );

      // 4. Call the intelligent payment orchestrator
      const result = await OrchestratorService.initializePayment(paymentData);

      if (!result.success) {
        throw new BadRequestError(
          result.error || "Erreur lors de l'initialisation du paiement.",
        );
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
          currency: currency || pkg.currency || "XOF",
          licences: total_licenses,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
