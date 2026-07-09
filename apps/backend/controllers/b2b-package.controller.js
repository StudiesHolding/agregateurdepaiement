import {
  CompanyPackage,
  FormationPackage,
  AccessRequest,
  Employee,
  Course,
  PostMeta,
  SpecificFormation,
  Order,
  BusinessThematique,
  sequelize,
} from "../models/index.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";

export const b2bPackageController = {
  /**
   * @route GET /api/v1/b2b/packages
   * @desc Get all packages owned by the company
   */
  getPackages: async (req, res, next) => {
    try {
      const companyId = req.company_id;
      const packages = await CompanyPackage.findAll({
        where: { company_id: companyId },
        include: [
          {
            model: FormationPackage,
            as: "package",
            attributes: [
              "id",
              "name",
              "description",
              "price",
              "image_url",
              "currency",
              "status",
              "target_audience",
              "formations",
              "featured",
              "max_licenses",
            ],
          },
        ],
      });

      res.json({
        status: "success",
        data: packages,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route GET /api/v1/b2b/packages/:id
   * @desc Get detailed information for a specific package
   */
  getPackageById: async (req, res, next) => {
    try {
      const { id } = req.params;
      // Get package details with specific attributes to avoid JOIN issues
      const pkg = await FormationPackage.findByPk(id, {
        attributes: [
          "id",
          "name",
          "description",
          "price",
          "image_url",
          "currency",
          "status",
          "target_audience",
          "formations",
          "featured",
          "max_licenses",
          "benefits",
          "custom_sections",
          "total_duration",
        ],
      });

      if (!pkg) {
        throw new NotFoundError("Package introuvable.");
      }

      res.json({
        status: "success",
        data: pkg,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route GET /api/v1/b2b/packages/catalog
   * @desc Get all available packages for purchase
   */
  getCatalog: async (req, res, next) => {
    try {
      // Get packages with only the fields we need to avoid JOIN issues
      const catalog = await FormationPackage.findAll({
        where: { status: "published" },
        attributes: [
          "id",
          "name",
          "description",
          "price",
          "image_url",
          "currency",
          "status",
          "target_audience",
          "formations",
          "featured",
          "max_licenses",
          "benefits",
          "custom_sections",
          "total_duration",
        ],
      });

      res.json({
        status: "success",
        data: catalog,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route POST /api/v1/b2b/licenses/assign
   * @desc Assign a license (Create Access Request)
   */
  assignLicense: async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const { employee_id, company_package_id } = req.body;
      const companyId = req.company_id;

      // 1. Verify Company Package & Availability
      const companyPackage = await CompanyPackage.findOne({
        where: {
          id: company_package_id,
          company_id: companyId,
          status: "active",
        },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (!companyPackage) {
        throw new NotFoundError(
          "Le package spécifié est introuvable ou inactif.",
        );
      }

      // First security check: Verify license availability before creating request
      // This prevents resource exhaustion and ensures proper license management
      if (companyPackage.used_licenses >= companyPackage.total_licenses) {
        throw new BadRequestError(
          "Toutes les licences de ce package ont été attribuées. Veuillez contacter votre administrateur pour obtenir des licences supplémentaires.",
        );
      }

      // 2. Verify Employee
      const employee = await Employee.findOne({
        where: { id: employee_id, company_id: companyId, is_active: true },
        transaction,
      });

      if (!employee) {
        throw new NotFoundError(
          "Le collaborateur spécifié est introuvable ou inactif.",
        );
      }

      // 3. Check for existing request or activation
      const existingRequest = await AccessRequest.findOne({
        where: {
          employee_id,
          company_package_id,
          status: ["pending", "processing", "activated"],
        },
        transaction,
      });

      if (existingRequest) {
        throw new BadRequestError(
          "Une demande d'accès est déjà en cours ou activée pour ce collaborateur sur ce package.",
        );
      }

      // 4. Create Access Request
      const newRequest = await AccessRequest.create(
        {
          company_id: companyId,
          employee_id,
          company_package_id,
          status: "pending",
        },
        { transaction },
      );

      // RESERVE: Increment used_licenses to reserve the license
      // This ensures the license is reserved for this request
      await companyPackage.increment("used_licenses", { by: 1, transaction });

      await transaction.commit();

      // Vision ATDD : assignation automatique + email X ou Y (pas de validation admin manuelle)
      try {
        const { B2bLicenseAssignService } = await import(
          "../services/b2b-license-assign.service.js"
        );
        await B2bLicenseAssignService.processAccessRequest(newRequest.id);
      } catch (assignError) {
        console.error("[b2bPackageController] Auto-assign failed:", assignError.message);
      }

      res.status(201).json({
        status: "success",
        data: newRequest,
      });
    } catch (err) {
      await transaction.rollback();
      next(err);
    }
  },

  /**
   * @route POST /api/v1/b2b/licenses/revoke
   * @desc Revoke a license (Deactivate request & restore count)
   */
  revokeLicense: async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const { access_request_id } = req.body;
      const companyId = req.company_id;

      const request = await AccessRequest.findOne({
        where: { id: access_request_id, company_id: companyId },
        transaction,
      });

      if (!request) {
        throw new NotFoundError("Demande d'accès introuvable.");
      }

      if (request.status === "rejected") {
        throw new BadRequestError("Cette demande est déjà rejetée.");
      }

      const companyPackage = await CompanyPackage.findByPk(
        request.company_package_id,
        { transaction },
      );

      // Decrement used count if it was previously counted (pending, processing, activated)
      // This ensures proper license tracking even if request was created before license was available
      if (["pending", "processing", "activated"].includes(request.status)) {
        await companyPackage.decrement("used_licenses", { by: 1, transaction });
      }

      await request.destroy({ transaction });

      await transaction.commit();

      res.json({
        status: "success",
        message: "Licence révoquée avec succès.",
      });
    } catch (err) {
      await transaction.rollback();
      next(err);
    }
  },

  /**
   * @route POST /api/v1/b2b/packages/:id/add-licenses
   * @desc Add more licenses to an existing package
   */
  addLicenses: async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const { id } = req.params;
      const { additional_licenses, paymentMethod, countryCode, currency } =
        req.body;
      const companyId = req.company_id;

      // Fallback: If company info not in request, fetch from database
      let companyEmail = req.company_email;
      let companyName = req.company_name;

      if (!companyEmail || !companyName) {
        const { Company, CompanyAdmin } = await import("../models/index.js");
        const company = await Company.findByPk(companyId);
        if (company) {
          companyName = company.name;
          companyEmail = company.email;
        }
        // Fallback to admin email if company email not found
        if (!companyEmail && req.admin?.id) {
          const admin = await CompanyAdmin.findByPk(req.admin.id);
          if (admin) {
            companyEmail = admin.email;
          }
        }
      }

      // 1. Find existing company package
      const companyPackage = await CompanyPackage.findOne({
        where: { id, company_id: companyId, status: "active" },
        include: [{ model: FormationPackage, as: "package" }],
        transaction,
      });

      if (!companyPackage) {
        throw new NotFoundError("Package actif introuvable.");
      }

      // 2. Validate number of licenses
      const additionalCount = parseInt(additional_licenses) || 0;
      if (additionalCount < 1) {
        throw new BadRequestError(
          "Le nombre de licences doit être au moins 1.",
        );
      }

      if (additionalCount > 1000) {
        throw new BadRequestError("Nombre maximum de licences: 1000.");
      }

      // 3. Calculate price
      const pkg = companyPackage.package;
      const unitPrice = Number(pkg.price) || 0;
      const totalAmount = unitPrice * additionalCount;

      if (totalAmount <= 0) {
        throw new BadRequestError("Prix invalide pour ce package.");
      }

      // 4. Prepare payment data
      const paymentData = {
        customerEmail: companyEmail,
        customerName: companyName,
        lmsItemId: pkg.id.toString(),
        lmsItemType: "package", // Use valid enum value - 'package_add_licenses' info goes in metadata
        paymentMethod: paymentMethod || "card",
        countryCode: countryCode || "CM",
        currency: currency || pkg.currency || "XOF",
        amount: totalAmount,
        successUrl: `${process.env.FRONTEND_URL || "http://localhost:3002"}/fr/dashboard/packages?payment=success&action=add_licenses`,
        cancelUrl: `${process.env.FRONTEND_URL || "http://localhost:3002"}/fr/dashboard/packages?payment=cancelled`,
        failedUrl: `${process.env.FRONTEND_URL || "http://localhost:3002"}/fr/dashboard/packages?payment=failed`,
        metadata: {
          is_b2b: true,
          b2b_purchase: true,
          purchase_type: "add_licenses", // Detailed type in metadata
          company_id: companyId,
          company_name: companyName,
          company_admin_email: companyEmail,
          company_package_id: id,
          licence_count: additionalCount,
          unit_price: unitPrice,
          previous_total_licenses: companyPackage.total_licenses,
          source: "b2b_dashboard_add_licenses",
        },
      };

      // 5. Call payment orchestrator
      const { OrchestratorService } =
        await import("../services/orchestrator.service.js");
      const result = await OrchestratorService.initializePayment(paymentData);

      if (!result.success) {
        throw new BadRequestError(
          result.error || "Erreur lors de l'initialisation du paiement.",
        );
      }

      // Store pending license addition in metadata for later processing
      const pendingAddition = {
        company_package_id: id,
        additional_licenses: additionalCount,
        order_reference: result.orderReference,
        status: "pending_payment",
      };

      await transaction.commit();

      res.status(201).json({
        status: "success",
        data: {
          orderReference: result.orderReference,
          orderRef: result.orderReference,
          paymentIntentId: result.paymentIntentId,
          redirectUrl: result.redirectUrl,
          widgetParams: result.widgetParams,
          provider: result.provider,
          clientSecret: result.clientSecret,
          amount: totalAmount,
          currency: currency || pkg.currency || "XOF",
          additional_licenses: additionalCount,
          current_licenses: companyPackage.total_licenses,
          new_total_licenses: companyPackage.total_licenses + additionalCount,
          package_name: pkg.name,
        },
      });
    } catch (err) {
      await transaction.rollback();
      next(err);
    }
  },

  /**
   * @route POST /api/v1/b2b/packages/purchase
   * @desc Initiate purchase of a new package via Purchase Engine
   * 
   * Ce controller ne crée plus directement Order ni CompanyPackage.
   * Il délègue au service référent (via initiatePayment) qui suit le flux :
   * Dashboard → API B2B → Orchestrator → PSP → Webhook → Dispatcher → Saga → Provisioning
   */
  purchasePackage: async (req, res, next) => {
    try {
      const { package_id, total_licenses, paymentMethod, countryCode, currency } = req.body;
      const companyId = req.company_id;
      const companyEmail = req.company_email;
      const companyName = req.company_name;

      if (!package_id) {
        throw new BadRequestError("package_id est requis.");
      }

      // Délégation au OrderController.initiatePayment qui utilise OrchestratorService
      // Cela garantit que le flux officiel est respecté
      const { OrchestratorService } = await import("../services/orchestrator.service.js");

      const pkg = await FormationPackage.findByPk(package_id);
      if (!pkg) {
        throw new NotFoundError("Package introuvable.");
      }

      const unitPrice = Number(pkg.price) || 0;
      const totalAmount = unitPrice * (total_licenses || 1);

      const paymentData = {
        customerEmail: companyEmail,
        customerName: companyName,
        lmsItemId: package_id.toString(),
        lmsItemType: "package",
        paymentMethod: paymentMethod || "card",
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
          licence_count: total_licenses || 1,
          unit_price: unitPrice,
          source: "b2b_dashboard",
        },
      };

      const result = await OrchestratorService.initializePayment(paymentData);

      if (!result.success) {
        throw new BadRequestError(
          result.error || "Erreur lors de l'initialisation du paiement.",
        );
      }

      res.status(201).json({
        status: "success",
        data: {
          message: "Achat initié avec succès. En attente de paiement.",
          orderReference: result.orderReference,
          orderRef: result.orderReference,
          paymentIntentId: result.paymentIntentId,
          redirectUrl: result.redirectUrl,
          widgetParams: result.widgetParams,
          provider: result.provider,
          clientSecret: result.clientSecret,
          amount: totalAmount,
          currency: currency || pkg.currency || "XOF",
          licences: total_licenses || 1,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route GET /api/v1/b2b/thematiques/catalog
   * @desc Get all active thematiques available for purchase
   */
  getThematiquesCatalog: async (req, res, next) => {
    try {
      const thematiques = await BusinessThematique.findAll({
        where: { status: "ACTIVE" },
        attributes: [
          "id",
          "title",
          "slug",
          "description",
          "icon",
          "color",
          "image_url",
          "status",
          "display_order",
        ],
        order: [["display_order", "ASC"], ["title", "ASC"]],
      });

      res.json({
        status: "success",
        data: thematiques,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route POST /api/v1/b2b/thematiques/purchase
   * @desc Initiate payment for a thematique
   */
  purchaseThematique: async (req, res, next) => {
    try {
      const { thematique_id, total_licenses, paymentMethod, countryCode, currency } = req.body;
      const companyId = req.company_id;
      const companyEmail = req.company_email;
      const companyName = req.company_name;

      if (!thematique_id) {
        throw new BadRequestError("thematique_id est requis.");
      }

      const { OrchestratorService } = await import("../services/orchestrator.service.js");

      const thematique = await BusinessThematique.findByPk(thematique_id);
      if (!thematique) {
        throw new NotFoundError("Thématique introuvable.");
      }

      const unitPrice = 50000;
      const amount = unitPrice * (total_licenses || 10);

      const paymentData = {
        customerEmail: companyEmail,
        customerName: companyName,
        lmsItemId: thematique_id.toString(),
        lmsItemType: "thematique",
        paymentMethod: paymentMethod || "card",
        countryCode: countryCode || "CM",
        currency: currency || "XOF",
        amount: amount,
        successUrl: `${process.env.FRONTEND_URL || "http://localhost:3002"}/fr/dashboard/packages?payment=success`,
        cancelUrl: `${process.env.FRONTEND_URL || "http://localhost:3002"}/fr/dashboard/catalog?payment=cancelled`,
        failedUrl: `${process.env.FRONTEND_URL || "http://localhost:3002"}/fr/dashboard/catalog?payment=failed`,
        metadata: {
          is_b2b: true,
          b2b_purchase: true,
          company_id: companyId,
          company_name: companyName,
          company_admin_email: companyEmail,
          licence_count: total_licenses || 10,
          unit_price: unitPrice,
          source: "b2b_dashboard",
          purchase_type: "thematique",
        },
      };

      const result = await OrchestratorService.initializePayment(paymentData);

      if (!result.success) {
        throw new BadRequestError(result.error || "Erreur lors de l'initialisation du paiement.");
      }

      res.status(201).json({
        status: "success",
        data: {
          message: "Achat initié avec succès. En attente de paiement.",
          orderReference: result.orderReference,
          orderRef: result.orderReference,
          paymentIntentId: result.paymentIntentId,
          redirectUrl: result.redirectUrl,
          widgetParams: result.widgetParams,
          provider: result.provider,
          clientSecret: result.clientSecret,
          amount: amount,
          currency: currency || "XOF",
          licences: total_licenses || 10,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};

