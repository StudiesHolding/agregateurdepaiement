import { Router } from "express";
import { catchAsync } from "../middlewares/error.middleware.js";
import { protectAdmin } from "../middlewares/admin.middleware.js";
import { FormationsService } from "../services/formations.service.js";
import { Order, FormationPackage } from "../models/index.js";
import sequelize from "../config/database.js";
import { QueryTypes } from "sequelize";
import { v4 as uuidv4 } from "uuid";
import { WebhookProcessor } from "../services/webhook-processor.service.js";
import { MailService } from "../services/mail.service.js";
import { PaymentIntent, PaymentAttempt } from "../models/index.js";
import { PaymentStatus } from "../enums/index.js";
import { B2BProvisioningService } from "../services/b2b-provisioning.service.js";

const router = Router();

// All test routes require admin API key
router.use(protectAdmin);

/**
 * GET /api/admin/test/formations
 * Get all available formations from WordPress/LearnPress
 */
router.get(
  "/formations",
  catchAsync(async (req, res) => {
    const formations = await FormationsService.getFormations();
    res.json({
      success: true,
      data: formations,
    });
  }),
);

/**
 * GET /api/admin/test/formations/:id
 * Get a single formation by ID
 */
router.get(
  "/formations/:id",
  catchAsync(async (req, res) => {
    const formation = await FormationsService.getFormation(req.params.id);
    if (!formation) {
      return res.status(404).json({
        success: false,
        message: "Formation non trouvée",
      });
    }
    res.json({
      success: true,
      data: formation,
    });
  }),
);

/**
 * POST /api/admin/test/orders
 * Create a test order
 */
router.post(
  "/orders",
  catchAsync(async (req, res) => {
    const {
      formationId,
      formationName,
      formationPrice,
      customerEmail,
      customerName,
      customerSurname,
      customerPhone,
      customerCity,
      customerCountry,
      purchaseType = "self",
      amount,
      // Gift specific
      beneficiaryEmail,
      beneficiaryFirstName,
      beneficiaryLastName,
      beneficiaryCountry,
      beneficiaryRelationship,
    } = req.body;

    // Validation
    if (!formationId || !customerEmail || !customerName) {
      return res.status(400).json({
        success: false,
        message: "formationId, customerEmail et customerName sont requis",
      });
    }

    // Generate unique reference
    const timestamp = Date.now().toString(36).toUpperCase();
    const shortUuid = uuidv4().split("-")[0].toUpperCase();
    const reference = `ORD-${timestamp}-${shortUuid}`;

    // Parse amount - use formationPrice if amount not specified
    const orderAmount = amount || formationPrice || 5000;

    // Create order
    const order = await Order.create({
      reference,
      customerEmail,
      customerName,
      customerSurname: customerSurname || null,
      customerPhone: customerPhone || null,
      customerCity: customerCity || null,
      currency: "XAF",
      totalAmount: orderAmount,
      status: "pending",
      formationId: formationId,
      formationName: formationName || `Formation #${formationId}`,
      formationPrice: orderAmount,
      lmsItemId: String(formationId),
      lmsItemType: "course",
      purchaseType,
      beneficiaryEmail: purchaseType === "gift" ? beneficiaryEmail : null,
      beneficiaryFirstName:
        purchaseType === "gift" ? beneficiaryFirstName : null,
      beneficiaryLastName: purchaseType === "gift" ? beneficiaryLastName : null,
      beneficiaryCountry: purchaseType === "gift" ? beneficiaryCountry : null,
      beneficiaryRelationship: purchaseType === "gift" ? beneficiaryRelationship : null,
      customerCountry: customerCountry || null,
      metadata: {
        courseId: formationId,
        courseName: formationName || `Formation #${formationId}`,
        source: "TEST_ORDER",
        packageType: "full_access",
      },
    });

    res.status(201).json({
      success: true,
      data: order,
    });
  }),
);

/**
 * POST /api/admin/test/orders/:id/simulate-payment
 * Simulate payment confirmation for a test order
 */
router.post(
  "/orders/:id/simulate-payment",
  catchAsync(async (req, res, next) => {
    const orderId = req.params.id;
    const statusParam = req.body?.status || "succeeded";

    // Update order status - use proper status values
    const newStatus =
      statusParam === "succeeded" ? "payment_confirmed" : "payment_failed";

    // First find the order
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Commande non trouvée",
      });
    }

    // Update with Sequelize to trigger hooks and validation
    await order.update({
      status: newStatus,
      paidAt: newStatus === "payment_confirmed" ? new Date() : null,
    });

    res.json({
      success: true,
      data: order,
    });
  }),
);

/**
 * POST /api/admin/test/simulate-webhook
 * Simulate a real webhook arrival to trigger emails and processed status transitions.
 */
router.post(
  "/simulate-webhook",
  catchAsync(async (req, res) => {
    const { orderId, provider = "cinetpay", status = "success" } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // 1. Create a PaymentIntent and PaymentAttempt if they don't exist
    // This is needed for WebhookProcessor to find the transaction
    const transactionNumber = `TEST-${order.reference}-${Date.now().toString(36)}`;

    const intent = await PaymentIntent.create({
      orderId: order.id,
      amount: order.totalAmount,
      currency: order.currency,
      status: PaymentStatus.PENDING,
      idempotencyKey: uuidv4()
    });

    const attempt = await PaymentAttempt.create({
      paymentIntentId: intent.id,
      providerId: 1, // Any valid provider ID
      transactionNumber,
      status: "pending"
    });

    // 2. Construct Payload
    let payload = {};
    if (provider === "cinetpay") {
      payload = {
        cpm_trans_id: transactionNumber,
        cpm_result: status === "success" ? "00" : "05",
        cpm_error_message: status === "success" ? "SUCCES" : "FAILED",
        event_type: "PAYMENT"
      };
    } else if (provider === "stripe") {
      payload = {
        type: status === "success" ? "checkout.session.completed" : "checkout.session.expired",
        data: {
          object: {
            id: `cs_test_${Date.now()}`,
            client_reference_id: transactionNumber,
            metadata: { transactionNumber }
          }
        }
      };
    }

    // 3. Process the event (Simulated)
    // Note: CinetPay would try to call back. To avoid this, we skip the real check in test mode.
    // In this specific system, we'll manually trigger the Processor results to ensure success.

    if (status === "success") {
      // Force status update and emails as if a real successful webhook happened
      attempt.paymentIntent = intent;
      intent.order = order;

      await WebhookProcessor.markAsSucceeded(
        attempt,
        payload,
        null // No transaction needed for simple test
      );

      // Use B2B specific email if this is a B2B order
      const metadata = order.metadata || {};
      if (metadata.is_b2b || metadata.b2b_purchase) {
        await MailService.sendB2BPaymentConfirmed(order);
      } else {
        await MailService.sendPaymentConfirmed(order);
      }
      await MailService.notifyLmsAdmins("success", order, intent);
    } else {
      attempt.paymentIntent = intent;
      intent.order = order;

      await WebhookProcessor.markAsFailed(
        attempt,
        payload,
        null
      );

      await MailService.sendPaymentFailureNotification(intent, order, "Simulation d'échec");
      await MailService.notifyLmsAdmins("failure", order, intent);
    }

    res.json({
      success: true,
      message: `Webhook ${provider} (${status}) simulé pour ${order.reference}`,
      data: {
        transactionNumber,
        orderStatus: status === "success" ? "payment_confirmed" : "payment_failed"
      }
    });
  }),
);

/**
 * POST /api/admin/test/reset-order/:id
 * Force reset an order to PENDING status for re-testing lifecycle
 */
router.post(
  "/orders/:id/reset",
  catchAsync(async (req, res) => {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ success: false });

    await order.update({
      status: "pending",
      validatedAt: null,
      completedAt: null,
      paidAt: null,
      rejectionReason: null
    });

    res.json({ success: true, data: order });
  })
);

/**
 * DELETE /api/admin/test/orders/:id
 * Delete a test order
 */
router.delete(
  "/orders/:id",
  catchAsync(async (req, res) => {
    const orderId = req.params.id;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Commande non trouvée",
      });
    }

    await order.destroy();

    res.json({
      success: true,
      message: "Commande supprimée",
    });
  }),
);

/**
 * POST /api/admin/test/b2b-orders
 * Create a test B2B package order
 */
router.post(
  "/b2b-orders",
  catchAsync(async (req, res) => {
    const {
      packageId,
      packageName,
      packagePrice,
      customerEmail,
      customerName,
      customerPhone,
      customerCountry,
      amount,
      // B2B specific
      companyName,
      companyIndustry,
      companyAdminEmail,
      licenceCount,
      unitPrice,
    } = req.body;

    // Validation
    if (!customerEmail || !customerName) {
      return res.status(400).json({
        success: false,
        message: "customerEmail et customerName sont requis",
      });
    }

    // Generate unique reference
    const timestamp = Date.now().toString(36).toUpperCase();
    const shortUuid = uuidv4().split("-")[0].toUpperCase();
    const reference = `B2B-${timestamp}-${shortUuid}`;

    // Parse amount
    const orderAmount = amount || packagePrice || (Number(licenceCount || 1) * Number(unitPrice || 50000));
    const licenses = licenceCount || 1;
    const pricePerLicense = unitPrice || packagePrice || 50000;

    // Create order with B2B metadata
    const order = await Order.create({
      reference,
      customerEmail: companyAdminEmail || customerEmail,
      customerName: companyName || customerName,
      customerSurname: null,
      customerPhone: customerPhone || null,
      customerCity: null,
      currency: "XAF",
      totalAmount: orderAmount,
      status: "pending",
      formationId: packageId || 1,
      formationName: packageName || "Pack Formation Entreprise",
      formationPrice: pricePerLicense,
      lmsItemId: String(packageId || "PACK-B2B-001"),
      lmsItemType: "package",
      purchaseType: "self",
      customerCountry: customerCountry || null,
      metadata: {
        is_b2b: true,
        b2b_purchase: true,
        packageId: packageId || "PACK-B2B-001",
        packageName: packageName || "Pack Formation Entreprise",
        source: "TEST_B2B_ORDER",
        company_name: companyName || customerName,
        company_industry: companyIndustry || "Technology",
        company_admin_email: companyAdminEmail || customerEmail,
        licence_count: licenses,
        backendLicenceCount: licenses,
        unit_price: pricePerLicense,
        backendUnitPrice: pricePerLicense,
      },
    });

    res.status(201).json({
      success: true,
      data: order,
    });
  }),
);

/**
 * POST /api/admin/test/b2b-orders/:id/simulate-payment
 * Simulate payment for B2B order
 */
router.post(
  "/b2b-orders/:id/simulate-payment",
  catchAsync(async (req, res) => {
    const orderId = req.params.id;
    const statusParam = req.body?.status || "succeeded";

    const newStatus = statusParam === "succeeded" ? "payment_confirmed" : "payment_failed";

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Commande non trouvée",
      });
    }

    await order.update({
      status: newStatus,
      paidAt: newStatus === "payment_confirmed" ? new Date() : null,
    });

    // Send B2B payment confirmation email
    if (newStatus === "payment_confirmed") {
      await MailService.sendB2BPaymentConfirmed(order);
    }

    res.json({
      success: true,
      data: order,
    });
  }),
);

/**
 * POST /api/admin/test/b2b-orders/:id/provision
 * Simulate B2B provisioning (create company, admin, send activation email with invoice)
 */
router.post(
  "/b2b-orders/:id/provision",
  catchAsync(async (req, res) => {
    const orderId = req.params.id;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Commande non trouvée",
      });
    }

    if (order.status !== "payment_confirmed") {
      return res.status(400).json({
        success: false,
        message: "La commande doit être en statut payment_confirmed pour être provisionnée",
      });
    }

    // Update order to validated status
    await order.update({
      status: "validated",
      validatedAt: new Date(),
    });

    // Trigger B2B provisioning (this will send activation email with invoice)
    try {
      await B2BProvisioningService.handleB2BOrder(order);

      res.json({
        success: true,
        message: "Provisioning B2B terminé. Email d'activation avec facture envoyé.",
        data: order,
      });
    } catch (error) {
      console.error("[Test B2B Provisioning] Error:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors du provisioning B2B: " + error.message,
      });
    }
  }),
);

/**
 * GET /api/admin/test/packages
 * Get available B2B packages from database
 */
router.get(
  "/packages",
  catchAsync(async (req, res) => {
    // Fetch packages from the FormationPackage table
    const packages = await FormationPackage.findAll({
      order: [['price', 'ASC']],
    });

    // Transform to expected format
    const formattedPackages = packages.map(pkg => ({
      id: String(pkg.id),
      name: pkg.title,
      description: pkg.description || '',
      pricePerLicense: parseFloat(pkg.price) || 0,
      currency: pkg.currency || 'EUR', // Default to EUR
      targetAudience: pkg.target_audience,
      status: pkg.status,
    }));

    res.json({
      success: true,
      data: formattedPackages,
    });
  }),
);

export default router;
