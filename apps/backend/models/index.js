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

// Associations

// Order <-> PaymentIntent (1:N)
Order.hasMany(PaymentIntent, { foreignKey: "orderId", as: "paymentIntents" });
PaymentIntent.belongsTo(Order, { foreignKey: "orderId", as: "order" });

// PaymentIntent <-> PaymentAttempt (1:N)
PaymentIntent.hasMany(PaymentAttempt, { foreignKey: "paymentIntentId", as: "attempts" });
PaymentAttempt.belongsTo(PaymentIntent, { foreignKey: "paymentIntentId", as: "paymentIntent" });

// PaymentIntent <-> PaymentProvider (Selected Provider)
PaymentIntent.belongsTo(PaymentProvider, { foreignKey: "selectedProviderId", as: "selectedProvider" });

// PaymentAttempt <-> PaymentProvider
PaymentAttempt.belongsTo(PaymentProvider, { foreignKey: "providerId", as: "provider" });

// PaymentProvider <-> ProviderRoute (1:N)
PaymentProvider.hasMany(ProviderRoute, { foreignKey: "providerId", as: "routes" });
ProviderRoute.belongsTo(PaymentProvider, { foreignKey: "providerId", as: "provider" });

// WebhookEvent <-> PaymentProvider
WebhookEvent.belongsTo(PaymentProvider, { foreignKey: "providerId", as: "provider" });

// ProviderStatsCache <-> PaymentProvider
ProviderStatsCache.belongsTo(PaymentProvider, { foreignKey: "providerId", as: "provider" });
PaymentProvider.hasMany(ProviderStatsCache, { foreignKey: "providerId", as: "statsCache" });

// Order <-> InstallmentPlan (1:N)
Order.hasMany(InstallmentPlan, { foreignKey: "orderId", as: "installmentPlans" });
InstallmentPlan.belongsTo(Order, { foreignKey: "orderId", as: "order" });

// InstallmentPlan <-> InstallmentPayment (1:N)
InstallmentPlan.hasMany(InstallmentPayment, { foreignKey: "planId", as: "payments" });
InstallmentPayment.belongsTo(InstallmentPlan, { foreignKey: "planId", as: "plan" });

// InstallmentPayment <-> PaymentIntent
InstallmentPayment.belongsTo(PaymentIntent, { foreignKey: "paymentIntentId", as: "paymentIntent" });

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
};
