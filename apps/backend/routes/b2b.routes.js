import { Router } from "express";
import { b2bAuthController } from "../controllers/b2b-auth.controller.js";
import { b2bDashboardController } from "../controllers/b2b-dashboard.controller.js";
import { b2bEmployeeController } from "../controllers/b2b-employee.controller.js";
import { b2bPackageController } from "../controllers/b2b-package.controller.js";
import { b2bRequestController } from "../controllers/b2b-request.controller.js";
import { b2bNotificationController } from "../controllers/b2b-notification.controller.js";
import { b2bOrderController } from "../controllers/b2b-order.controller.js";
import { isCompanyAdmin } from "../middlewares/b2b-admin.middleware.js";
import { validateB2B } from "../middlewares/b2b-validator.middleware.js";
import * as B2BValidators from "../validators/b2b.validator.js";

const router = Router();

// ============================================
// PUBILC ROUTES
// ============================================

// Authentification
router.post("/auth/login", validateB2B(B2BValidators.loginSchema), b2bAuthController.login);
router.post("/auth/activate", b2bAuthController.activate);

// ============================================
// PROTECTED ROUTES (Requires B2B Admin JWT)
// ============================================
router.use(isCompanyAdmin);

// Profil Base
router.get("/auth/me", b2bAuthController.getMe);
router.put("/auth/profile", b2bAuthController.updateProfile);
router.put("/auth/password", b2bAuthController.changePassword);

// Dashboard
router.get("/dashboard/stats", b2bDashboardController.getStats);

// Équipe (Collaborateurs)
router.get("/employees", b2bEmployeeController.getAll);
router.post("/employees", validateB2B(B2BValidators.employeeSchema), b2bEmployeeController.create);
router.put("/employees/:id", validateB2B(B2BValidators.employeeSchema), b2bEmployeeController.update);
router.delete("/employees/:id", b2bEmployeeController.delete);

// Packages & Licences
router.get("/packages", b2bPackageController.getPackages);
router.get("/packages/catalog", b2bPackageController.getCatalog);
router.get("/packages/:id", b2bPackageController.getPackageById);
router.post("/packages/purchase", validateB2B(B2BValidators.purchaseSchema), b2bPackageController.purchasePackage);
router.post("/packages/:id/add-licenses", b2bPackageController.addLicenses); // NOUVEAU: Ajouter des licences
router.post("/licenses/assign", validateB2B(B2BValidators.assignLicenseSchema), b2bPackageController.assignLicense);
router.post("/licenses/revoke", b2bPackageController.revokeLicense);

// Demandes d'accès
router.get("/requests", b2bRequestController.getAll);
router.get("/requests/:id", b2bRequestController.getById);
router.put("/requests/:id/status", validateB2B(B2BValidators.updateRequestStatusSchema), b2bRequestController.updateStatus);
router.post("/requests/:id/approve", b2bRequestController.approve);
router.post("/requests/:id/reject", b2bRequestController.reject);

// Notifications
router.get("/notifications", b2bNotificationController.getAll);
router.patch("/notifications/:id/read", b2bNotificationController.markRead);
router.patch("/notifications/read-all", b2bNotificationController.markAllRead);

// Orders
router.get("/orders", b2bOrderController.getAll);
router.get("/orders/:id", b2bOrderController.getById);
router.get("/orders/:id/invoice", b2bOrderController.getInvoice);
router.post("/orders/initiate-payment", b2bOrderController.initiatePayment);

export default router;
