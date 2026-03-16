import sequelize from "../config/database.js";
import { Order } from "./order.model.js";
import { PaymentProvider } from "./payment-provider.model.js";
import { PaymentIntent } from "./payment-intent.model.js";
import { PaymentAttempt } from "./payment-attempt.model.js";
import { ProviderRoute } from "./provider-route.model.js";
import { WebhookEvent } from "./webhook-event.model.js";
import { InstallmentPlan } from "./installment-plan.model.js";
import { InstallmentPayment } from "./installment-payment.model.js";
import { ApiKey } from "./api-key.model.js";
import { VerifiedEmail } from "./verified-email.model.js";
import { AdminAuditLog } from "./admin-audit-log.model.js";
import { ProviderStatsCache } from "./provider-stats-cache.model.js";
import { NotificationSettings } from "./notification-settings.model.js";
import { OrderAuditLog } from "./order-audit-log.model.js";
import { AdminNotification } from "./admin-notification.model.js";
import { Company } from "./company.model.js";
import { CompanyAdmin } from "./company-admin.model.js";
import { Employee } from "./employee.model.js";
import { FormationPackage } from "./formation-package.model.js";
import { CompanyPackage } from "./company-package.model.js";
import { AccessRequest } from "./access-request.model.js";
import { Course } from "./course.model.js";
import { PostMeta } from "./post-meta.model.js";
import { PackageFormation } from "./package-formation.model.js";
import { SpecificFormation } from "./specific-formation.model.js";

// Associations

// Order <-> PaymentIntent (1:N)
Order.hasMany(PaymentIntent, { foreignKey: "orderId", as: "paymentIntents" });
PaymentIntent.belongsTo(Order, { foreignKey: "orderId", as: "order" });

// PaymentIntent <-> PaymentAttempt (1:N)
PaymentIntent.hasMany(PaymentAttempt, {
  foreignKey: "paymentIntentId",
  as: "attempts",
});
PaymentAttempt.belongsTo(PaymentIntent, {
  foreignKey: "paymentIntentId",
  as: "paymentIntent",
});

// PaymentIntent <-> PaymentProvider (Selected Provider)
PaymentIntent.belongsTo(PaymentProvider, {
  foreignKey: "selectedProviderId",
  as: "selectedProvider",
});

// PaymentAttempt <-> PaymentProvider
PaymentAttempt.belongsTo(PaymentProvider, {
  foreignKey: "providerId",
  as: "provider",
});

// PaymentProvider <-> ProviderRoute (1:N)
PaymentProvider.hasMany(ProviderRoute, {
  foreignKey: "providerId",
  as: "routes",
});
ProviderRoute.belongsTo(PaymentProvider, {
  foreignKey: "providerId",
  as: "provider",
});

// WebhookEvent <-> PaymentProvider
WebhookEvent.belongsTo(PaymentProvider, {
  foreignKey: "providerId",
  as: "provider",
});

// ProviderStatsCache <-> PaymentProvider
ProviderStatsCache.belongsTo(PaymentProvider, {
  foreignKey: "providerId",
  as: "provider",
});
PaymentProvider.hasMany(ProviderStatsCache, {
  foreignKey: "providerId",
  as: "statsCache",
});

// Order <-> InstallmentPlan (1:N)
Order.hasMany(InstallmentPlan, {
  foreignKey: "orderId",
  as: "installmentPlans",
});
InstallmentPlan.belongsTo(Order, { foreignKey: "orderId", as: "order" });

// InstallmentPlan <-> InstallmentPayment (1:N)
InstallmentPlan.hasMany(InstallmentPayment, {
  foreignKey: "planId",
  as: "payments",
});
InstallmentPayment.belongsTo(InstallmentPlan, {
  foreignKey: "planId",
  as: "plan",
});

// InstallmentPayment <-> PaymentIntent
InstallmentPayment.belongsTo(PaymentIntent, {
  foreignKey: "paymentIntentId",
  as: "paymentIntent",
});

// ============================================
// B2B ASSOCIATIONS
// ============================================

// Company <-> CompanyAdmin (1:N)
Company.hasMany(CompanyAdmin, { foreignKey: "company_id", as: "admins" });
CompanyAdmin.belongsTo(Company, { foreignKey: "company_id", as: "company" });

// Company <-> Employee (1:N)
Company.hasMany(Employee, { foreignKey: "company_id", as: "employees" });
Employee.belongsTo(Company, { foreignKey: "company_id", as: "company" });

// Company <-> CompanyPackage (1:N)
Company.hasMany(CompanyPackage, { foreignKey: "company_id", as: "packages" });
CompanyPackage.belongsTo(Company, { foreignKey: "company_id", as: "company" });

// FormationPackage <-> CompanyPackage (1:N)
FormationPackage.hasMany(CompanyPackage, { foreignKey: "package_id", as: "companyPurchases" });
CompanyPackage.belongsTo(FormationPackage, { foreignKey: "package_id", as: "package" });

// Company <-> AccessRequest (1:N)
Company.hasMany(AccessRequest, { foreignKey: "company_id", as: "accessRequests" });
AccessRequest.belongsTo(Company, { foreignKey: "company_id", as: "company" });

// Employee <-> AccessRequest (1:N)
Employee.hasMany(AccessRequest, { foreignKey: "employee_id", as: "requests" });
AccessRequest.belongsTo(Employee, { foreignKey: "employee_id", as: "employee" });

// CompanyPackage <-> AccessRequest (1:N)
CompanyPackage.hasMany(AccessRequest, { foreignKey: "company_package_id", as: "activations" });
AccessRequest.belongsTo(CompanyPackage, { foreignKey: "company_package_id", as: "companyPackage" });

// ============================================
// TRAINING PACKAGES & LEARNPRESS
// ============================================

// Course <-> PostMeta (1:N)
Course.hasMany(PostMeta, { foreignKey: "post_id", as: "meta" });
PostMeta.belongsTo(Course, { foreignKey: "post_id", as: "course" });

// FormationPackage <-> PackageFormation (1:N)
FormationPackage.hasMany(PackageFormation, { foreignKey: "package_id", as: "packageFormations" });
PackageFormation.belongsTo(FormationPackage, { foreignKey: "package_id", as: "package" });

// PackageFormation <-> Course (N:1, can be global or specific)
PackageFormation.belongsTo(Course, { foreignKey: "global_formation_id", as: "globalCourse" });
PackageFormation.belongsTo(SpecificFormation, { foreignKey: "package_formation_id", as: "specificCourse" });

// FormationPackage <-> SpecificFormation (1:N)
FormationPackage.hasMany(SpecificFormation, { foreignKey: "package_id", as: "specificFormations" });
SpecificFormation.belongsTo(FormationPackage, { foreignKey: "package_id", as: "package" });

export {
  sequelize,
  Order,
  PaymentProvider,
  PaymentIntent,
  PaymentAttempt,
  ProviderRoute,
  WebhookEvent,
  InstallmentPlan,
  InstallmentPayment,
  ApiKey,
  VerifiedEmail,
  AdminAuditLog,
  ProviderStatsCache,
  NotificationSettings,
  OrderAuditLog,
  AdminNotification,
  Company,
  CompanyAdmin,
  Employee,
  FormationPackage,
  CompanyPackage,
  AccessRequest,
  Course,
  PostMeta,
  PackageFormation,
  SpecificFormation,
};
