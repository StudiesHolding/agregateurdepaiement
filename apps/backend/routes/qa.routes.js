/**
 * Routes QA ATDD — actives uniquement si NODE_ENV=test
 * Protégées par x-internal-key (INTERNAL_API_KEY)
 *
 * Remplacent WordPress en local : initient des paiements comme le ferait
 * le formulaire PHP avec metadata MOODLE_HEADLESS / B2B / AUCTION.
 */
import { Router } from "express";
import { catchAsync } from "../middlewares/error.middleware.js";
import { requireInternalKey } from "../middlewares/internal-auth.middleware.js";
import { v4 as uuidv4 } from "uuid";
import { Order, PaymentIntent, PaymentAttempt } from "../models/index.js";
import { PaymentStatus } from "../enums/index.js";
import { OrchestratorService } from "../services/orchestrator.service.js";
import { QaPaymentInitService } from "../services/qa-payment-init.service.js";
import { WebhookProcessor } from "../services/webhook-processor.service.js";
import { MailService } from "../services/mail.service.js";

const router = Router();
router.use(requireInternalKey);

/**
 * POST /api/qa/payments/init-b2c
 * Simule le payload WordPress formulaire-payement v3 avec MOODLE_HEADLESS.
 */
router.post(
  "/payments/init-b2c",
  catchAsync(async (req, res) => {
    const {
      formationId = Number(process.env.E2E_FORMATION_ID || 2),
      formationName = "Formation Studies Learning (Moodle mappée)",
      customerEmail,
      customerName = "Test",
      customerSurname = "Student",
      amount = 50000,
      currency = "XOF",
      paymentMethod = "card",
      countryCode = "CI",
    } = req.body;

    if (!customerEmail) {
      return res.status(400).json({ status: "fail", message: "customerEmail requis" });
    }

    const { FormationMappingService } = await import(
      "../services/formation-mapping.service.js"
    );
    const mapping = await FormationMappingService.assertFormationMappable(formationId);

    const result = await QaPaymentInitService.initialize({
      customerEmail,
      customerName,
      customerSurname,
      amount,
      currency,
      metadata: {
        formation_id: formationId,
        formation_name: formationName,
        source: "MOODLE_HEADLESS",
        is_headless: true,
      },
      successUrl: "http://localhost:3099/qa/payment/success",
    });

    res.json({
      status: "success",
      data: { ...result, moodleCourseId: mapping.moodleCourseId },
    });
  }),
);

/**
 * POST /api/qa/payments/:orderRef/simulate-success
 * Simule le webhook PSP → PAYMENT_CONFIRMED → Saga MOODLE_HEADLESS
 */
router.post(
  "/payments/:orderRef/simulate-success",
  catchAsync(async (req, res) => {
    const { orderRef } = req.params;
    const { QaPaymentSimulationService } = await import(
      "../services/qa-payment-simulation.service.js"
    );
    const result = await QaPaymentSimulationService.simulateSuccess(orderRef);
    res.json({ status: "success", ...result });
  }),
);

/**
 * DELETE /api/qa/mailpit/messages — proxy reset Mailpit
 */
router.delete(
  "/mailpit/messages",
  catchAsync(async (_req, res) => {
    const mailpitUrl = process.env.MAILPIT_API_URL || "http://localhost:8025";
    try {
      await fetch(`${mailpitUrl}/api/v1/messages`, { method: "DELETE" });
      res.json({ success: true });
    } catch {
      res.json({ success: false, message: "Mailpit indisponible" });
    }
  }),
);

/**
 * POST /api/qa/sso/reset-pending
 * Remet un utilisateur en état « SSO en attente » (tests J1 — premier achat).
 */
router.post(
  "/sso/reset-pending",
  catchAsync(async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ status: "fail", message: "email requis" });
    }
    const sequelize = (await import("../config/database.js")).default;
    const { QueryTypes } = await import("sequelize");
    await sequelize.query(
      `UPDATE kyd4_users SET keycloak_id = NULL, user_pass = '' WHERE user_email = :email`,
      { replacements: { email }, type: QueryTypes.UPDATE },
    );
    res.json({ status: "success", email, ssoPending: true });
  }),
);

/**
 * POST /api/qa/payments/init-b2b-package
 * Simule l'achat d'un package B2B depuis le tunnel (sans WordPress).
 */
router.post(
  "/payments/init-b2b-package",
  catchAsync(async (req, res) => {
    const {
      companyEmail,
      companyName = "QA Corp ATDD",
      packageId = 1,
      totalLicenses = 5,
      amount = 250000,
      currency = "XOF",
      paymentMethod = "card",
      countryCode = "CI",
    } = req.body;

    if (!companyEmail) {
      return res.status(400).json({ status: "fail", message: "companyEmail requis" });
    }

    const result = await QaPaymentInitService.initialize({
      customerEmail: companyEmail,
      customerName: companyName,
      amount,
      currency,
      lmsItemId: String(packageId),
      lmsItemType: "package",
      metadata: {
        is_b2b: true,
        b2b_purchase: true,
        company_name: companyName,
        company_admin_email: companyEmail,
        licence_count: totalLicenses,
        package_id: packageId,
        source: "B2B_PACKAGE",
        purchase_type: "package",
      },
      successUrl: `${process.env.B2B_DASHBOARD_URL || "http://localhost:3002"}/fr/dashboard/packages?payment=success`,
    });

    res.json({ status: "success", data: result });
  }),
);

/**
 * POST /api/qa/payments/init-b2b-thematique
 * Vision cible : achat d'une thématique entière (tous ses packages inclus).
 */
router.post(
  "/payments/init-b2b-thematique",
  catchAsync(async (req, res) => {
    const {
      companyEmail,
      companyName = "QA Corp ATDD",
      thematiqueId = 1,
      totalLicenses = 10,
      amount = 500000,
      currency = "XOF",
      paymentMethod = "card",
      countryCode = "CI",
    } = req.body;

    if (!companyEmail) {
      return res.status(400).json({ status: "fail", message: "companyEmail requis" });
    }

    const result = await QaPaymentInitService.initialize({
      customerEmail: companyEmail,
      customerName: companyName,
      amount,
      currency,
      metadata: {
        is_b2b: true,
        b2b_purchase: true,
        company_name: companyName,
        company_admin_email: companyEmail,
        licence_count: totalLicenses,
        thematique_id: thematiqueId,
        source: "B2B_THEMATIQUE",
        purchase_type: "thematique",
      },
      successUrl: `${process.env.B2B_DASHBOARD_URL || "http://localhost:3002"}/fr/dashboard/packages?payment=success`,
    });

    res.json({ status: "success", data: result });
  }),
);

/**
 * POST /api/qa/b2b/seed-tenant
 * Crée une entreprise + manager actif pour les journeys B2B.
 */
router.post(
  "/b2b/seed-tenant",
  catchAsync(async (req, res) => {
    const {
      managerEmail,
      password = "QaStudies2026!",
      companyName = "QA Corp ATDD",
      packageId,
      totalLicenses = 5,
      withActivePackage = false,
    } = req.body;

    if (!managerEmail) {
      return res.status(400).json({ status: "fail", message: "managerEmail requis" });
    }

    const { Company, CompanyAdmin, CompanyPackage, FormationPackage } = await import(
      "../models/index.js"
    );

    let company = await Company.findOne({ where: { email: managerEmail } });
    if (!company) {
      company = await Company.create({ name: companyName, email: managerEmail });
    }

    let admin = await CompanyAdmin.findOne({ where: { email: managerEmail } });
    if (!admin) {
      admin = await CompanyAdmin.create({
        company_id: company.id,
        email: managerEmail,
        password_hash: password,
        first_name: "Marc",
        last_name: "Manager",
        is_active: true,
        role: "admin",
      });
    } else {
      admin.password_hash = password;
      admin.is_active = true;
      admin.changed("password_hash", true);
      await admin.save();
    }

    let companyPackageId;
    if (withActivePackage) {
      const pkg = packageId
        ? await FormationPackage.findByPk(packageId)
        : await FormationPackage.findOne({ where: { status: "active" } });

      if (pkg) {
        const cp = await CompanyPackage.create({
          company_id: company.id,
          package_id: pkg.id,
          total_licenses: totalLicenses,
          used_licenses: 0,
          status: "active",
          purchase_date: new Date(),
        });
        companyPackageId = cp.id;
      }
    }

    res.json({
      companyId: company.id,
      adminId: admin.id,
      companyPackageId,
      managerEmail,
      password,
    });
  }),
);

/**
 * POST /api/qa/platform/seed-user
 * Crée un utilisateur plateforme existant (Email X — compte SSO déjà provisionné).
 */
router.post(
  "/platform/seed-user",
  catchAsync(async (req, res) => {
    const { email, firstName = "Xavier", lastName = "Existant" } = req.body;
    if (!email) {
      return res.status(400).json({ status: "fail", message: "email requis" });
    }

    const sequelize = (await import("../config/database.js")).default;
    const { QueryTypes } = await import("sequelize");

    const existing = await sequelize.query(
      `SELECT ID FROM kyd4_users WHERE user_email = :email LIMIT 1`,
      { replacements: { email }, type: QueryTypes.SELECT },
    );

    if (existing.length === 0) {
      await sequelize.query(
        `INSERT INTO kyd4_users (user_login, user_email, user_registered, display_name, keycloak_id)
         VALUES (:login, :email, NOW(), :displayName, :keycloakId)`,
        {
          replacements: {
            login: email.split("@")[0],
            email,
            displayName: `${firstName} ${lastName}`,
            keycloakId: `qa-kc-${Date.now()}`,
          },
        },
      );
    }

    res.json({ success: true, email, exists: true });
  }),
);

/**
 * GET /api/qa/orders/:orderRef/status
 * Vérifie le statut d'une commande après provisioning saga
 */
router.get(
  "/orders/:orderRef/status",
  catchAsync(async (req, res) => {
    const { orderRef } = req.params;
    const order = await Order.findOne({ where: { reference: orderRef } });
    if (!order) {
      return res.status(404).json({ status: "fail", message: "Commande introuvable" });
    }
    res.json({
      status: "success",
      data: {
        reference: order.reference,
        status: order.status,
        completedAt: order.completedAt,
        metadata: order.metadata,
      },
    });
  }),
);

export default router;
