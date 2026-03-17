import { Router } from "express";
import { catchAsync } from "../middlewares/error.middleware.js";
import { protectAdmin, auditLog } from "../middlewares/admin.middleware.js";
import { AnalyticsService } from "../services/analytics.service.js";
import { LmsBridgeService } from "../services/lms-bridge.service.js";
import {
    PaymentProvider,
    PaymentIntent,
    PaymentAttempt,
    ProviderRoute,
    WebhookEvent,
    Order,
} from "../models/index.js";
import { ProviderFactory } from "../providers/index.js";
import { WebhookProcessor } from "../services/webhook-processor.service.js";
import { ProviderRouterService } from "../services/provider-router.service.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";
import { Op } from "sequelize";
import { OrderController } from "../controllers/order.controller.js";
import { NotificationController } from "../controllers/notification.controller.js";
import { AdminNotificationController } from "../controllers/admin-notification.controller.js";
import { AdminCompanyController } from "../controllers/admin-company.controller.js";

const router = Router();

// All admin routes require admin-level API Key
router.use(protectAdmin);

// ══════════════════════════════════════════════════════════
// 📊 KPIs & ANALYTICS
// ══════════════════════════════════════════════════════════

/**
 * GET /api/admin/kpis/overview
 * Global KPIs for the Command Center
 */
router.get("/kpis/overview", catchAsync(async (req, res) => {
    const kpis = await AnalyticsService.getOverviewKpis();
    res.json({ status: "success", data: kpis });
}));

/**
 * GET /api/admin/kpis/timeseries?period=30d
 * Revenue and transaction count time-series data for charts
 */
router.get("/kpis/timeseries", catchAsync(async (req, res) => {
    const { period = "30d" } = req.query;
    const data = await AnalyticsService.getTimeSeries(period);
    res.json({ status: "success", data });
}));

/**
 * GET /api/admin/kpis/lms?period=30d&limit=10
 * LMS-specific analytics: top formations, wallet summary
 */
router.get("/kpis/lms", catchAsync(async (req, res) => {
    const { period = "30d", limit = 10 } = req.query;

    const [topFormations, walletSummary, formationsStats] = await Promise.all([
        LmsBridgeService.getTopFormations(parseInt(limit), period),
        LmsBridgeService.getWalletSummary(),
        LmsBridgeService.getFormationsStats(),
    ]);

    res.json({
        status: "success",
        data: { topFormations, walletSummary, formationsStats },
    });
}));

/**
 * GET /api/admin/analytics/geo?period=30d
 * Geographic breakdown: volume and success rate by country
 */
router.get("/analytics/geo", catchAsync(async (req, res) => {
    const { period = "30d" } = req.query;
    const data = await AnalyticsService.getGeoBreakdown(period);
    res.json({ status: "success", data });
}));

/**
 * GET /api/admin/analytics/providers?period=24h
 * Provider performance overview
 */
router.get("/analytics/providers", catchAsync(async (req, res) => {
    const { period = "24h" } = req.query;
    const data = await AnalyticsService.getProviderPerformance(period);
    res.json({ status: "success", data });
}));

// ══════════════════════════════════════════════════════════
// 🏭 PROVIDERS
// ══════════════════════════════════════════════════════════

/**
 * GET /api/admin/providers
 * All providers with their 24h health stats
 */
router.get("/providers", catchAsync(async (req, res) => {
    const { period = "24h" } = req.query;
    const providers = await AnalyticsService.getProviderPerformance(period);
    res.json({ status: "success", data: providers });
}));

/**
 * GET /api/admin/providers/factory-codes
 * Returns the list of provider codes that the ProviderFactory can instantiate.
 * Used by the frontend Add Provider wizard to show which codes are "ready" backend-side.
 */
router.get("/providers/factory-codes", catchAsync(async (req, res) => {
    // These are the codes currently implemented in ProviderFactory
    const supportedCodes = ["stripe", "cinetpay", "kkiapay", "maviance"];
    res.json({ status: "success", data: supportedCodes });
}));

/**
 * GET /api/admin/providers/:id/sparkline
 * 48h hourly success rate sparkline for a specific provider
 */
router.get("/providers/:id/sparkline", catchAsync(async (req, res) => {
    const data = await AnalyticsService.getProviderSparkline(req.params.id);
    res.json({ status: "success", data });
}));

/**
 * GET /api/admin/providers/:id/errors?period=24h
 * Top errors for a specific provider
 */
router.get("/providers/:id/errors", catchAsync(async (req, res) => {
    const { period = "24h" } = req.query;
    const data = await AnalyticsService.getProviderTopErrors(req.params.id, period);
    res.json({ status: "success", data });
}));

/**
 * POST /api/admin/providers
 * Register a new payment provider in the database
 */
router.post(
    "/providers",
    auditLog("CREATE_PROVIDER", "provider"),
    catchAsync(async (req, res) => {
        const { code, name, apiEndpoint, supportCard, supportMobileMoney, credentials } = req.body;

        if (!code || !name) {
            throw new BadRequestError("code and name are required");
        }

        // Check for duplicate code
        const existing = await PaymentProvider.findOne({ where: { code } });
        if (existing) {
            throw new BadRequestError(`Provider with code '${code}' already exists`);
        }

        const provider = await PaymentProvider.create({
            code: code.toLowerCase().trim(),
            name,
            apiEndpoint: apiEndpoint || null,
            supportCard: supportCard ?? false,
            supportMobileMoney: supportMobileMoney ?? true,
            isActive: false, // Disabled until routes are configured
            credentialsEncrypted: credentials || null,
        });

        res.status(201).json({
            status: "success",
            data: { ...provider.toJSON(), credentialsEncrypted: undefined },
            message: `Provider '${name}' registered. Configure routes to activate.`,
            webhookUrl: `/api/webhooks/${code.toLowerCase()}`,
        });
    })
);

/**
 * PUT /api/admin/providers/:id
 * Update provider details
 */
router.put(
    "/providers/:id",
    auditLog("UPDATE_PROVIDER", "provider"),
    catchAsync(async (req, res) => {
        const provider = await PaymentProvider.findByPk(req.params.id);
        if (!provider) throw new NotFoundError("Provider not found");

        const { name, apiEndpoint, supportCard, supportMobileMoney, credentials } = req.body;

        await provider.update({
            ...(name && { name }),
            ...(apiEndpoint !== undefined && { apiEndpoint }),
            ...(supportCard !== undefined && { supportCard }),
            ...(supportMobileMoney !== undefined && { supportMobileMoney }),
            ...(credentials && { credentialsEncrypted: credentials }),
        });

        res.json({
            status: "success",
            data: { ...provider.toJSON(), credentialsEncrypted: undefined },
        });
    })
);

/**
 * PUT /api/admin/providers/:id/toggle
 * Activate or deactivate a provider
 */
router.put(
    "/providers/:id/toggle",
    auditLog("TOGGLE_PROVIDER", "provider"),
    catchAsync(async (req, res) => {
        const provider = await PaymentProvider.findByPk(req.params.id);
        if (!provider) throw new NotFoundError("Provider not found");

        await provider.update({ isActive: !provider.isActive });

        res.json({
            status: "success",
            data: {
                id: provider.id,
                name: provider.name,
                isActive: provider.isActive,
            },
            message: `Provider '${provider.name}' is now ${provider.isActive ? "ACTIVE" : "INACTIVE"}`,
        });
    })
);

/**
 * POST /api/admin/providers/:id/test
 * Test provider API connectivity (live ping)
 */
router.post("/providers/:id/test", catchAsync(async (req, res) => {
    const provider = await PaymentProvider.findByPk(req.params.id);
    if (!provider) throw new NotFoundError("Provider not found");

    try {
        // Try instantiating the adapter — will throw if code is unsupported
        ProviderFactory.getProvider(provider.code, {
            apiKey: provider.credentialsEncrypted?.apiKey,
            siteId: provider.credentialsEncrypted?.siteId,
            secretKey: provider.credentialsEncrypted?.secretKey,
        });

        res.json({
            status: "success",
            message: `Provider '${provider.name}' adapter instantiated successfully. Credentials format OK.`,
        });
    } catch (err) {
        res.json({
            status: "fail",
            message: err.message,
        });
    }
}));

// ══════════════════════════════════════════════════════════
// 🌍 ROUTING RULES
// ══════════════════════════════════════════════════════════

/**
 * GET /api/admin/routes
 * All routing rules with provider info
 */
router.get("/routes", catchAsync(async (req, res) => {
    const routes = await ProviderRoute.findAll({
        include: [{ model: PaymentProvider, as: "provider" }],
        order: [["countryCode", "ASC"], ["priority", "ASC"]],
    });

    const data = routes.map(r => ({
        id: r.id,
        provider: { id: r.provider.id, name: r.provider.name, code: r.provider.code },
        countryCode: r.countryCode,
        currency: r.currency,
        minAmount: r.minAmount,
        maxAmount: r.maxAmount,
        priority: r.priority,
        isActive: r.isActive,
    }));

    res.json({ status: "success", data });
}));

/**
 * GET /api/admin/routes/matrix
 * Routing matrix: countries x providers
 */
router.get("/routes/matrix", catchAsync(async (req, res) => {
    const routes = await ProviderRoute.findAll({
        include: [{ model: PaymentProvider, as: "provider" }],
        order: [["priority", "ASC"]],
    });

    const providers = await PaymentProvider.findAll({ where: { isActive: true } });

    // Build matrix: { [countryCode]: { [providerCode]: route } }
    const matrix = {};
    const countries = [...new Set(routes.map(r => r.countryCode))];

    for (const country of countries) {
        matrix[country] = {};
        for (const route of routes.filter(r => r.countryCode === country)) {
            matrix[country][route.provider.code] = {
                routeId: route.id,
                priority: route.priority,
                isActive: route.isActive,
                currency: route.currency,
            };
        }
    }

    res.json({
        status: "success",
        data: { matrix, countries, providers: providers.map(p => ({ id: p.id, name: p.name, code: p.code })) },
    });
}));

/**
 * POST /api/admin/routes/simulate
 * Simulate provider routing for given parameters
 * body: { countryCode, currency, amount, paymentMethod }
 */
router.post("/routes/simulate", catchAsync(async (req, res) => {
    const { countryCode = "CM", currency = "XAF", amount = 1000, paymentMethod = "mobile_money" } = req.body;

    const rawRoutes = await ProviderRouterService.findAvailableRoutes(countryCode, currency, amount);
    const filteredRoutes = ProviderRouterService.filterByPaymentMethod(rawRoutes, paymentMethod);

    const chain = filteredRoutes.map((r, index) => ({
        position: index + 1,
        providerId: r.provider.id,
        providerName: r.provider.name,
        providerCode: r.provider.code,
        priority: r.priority,
        isActive: r.isActive,
    }));

    res.json({
        status: "success",
        data: {
            input: { countryCode, currency, amount, paymentMethod },
            selectedProvider: chain[0] || null,
            fallbackChain: chain.slice(1),
            totalCandidates: chain.length,
        },
    });
}));

/**
 * POST /api/admin/routes
 * Create a new routing rule
 */
router.post(
    "/routes",
    auditLog("CREATE_ROUTE", "route"),
    catchAsync(async (req, res) => {
        const { providerId, countryCode, currency, minAmount, maxAmount, priority } = req.body;

        if (!providerId || !countryCode || !currency) {
            throw new BadRequestError("providerId, countryCode, and currency are required");
        }

        const provider = await PaymentProvider.findByPk(providerId);
        if (!provider) throw new NotFoundError("Provider not found");

        const route = await ProviderRoute.create({
            providerId,
            countryCode: countryCode.toUpperCase(),
            currency: currency.toUpperCase(),
            minAmount: minAmount || 0,
            maxAmount: maxAmount || null,
            priority: priority || 1,
            isActive: true,
        });

        res.status(201).json({ status: "success", data: route });
    })
);

/**
 * PUT /api/admin/routes/:id
 * Update a routing rule
 */
router.put(
    "/routes/:id",
    auditLog("UPDATE_ROUTE", "route"),
    catchAsync(async (req, res) => {
        const route = await ProviderRoute.findByPk(req.params.id);
        if (!route) throw new NotFoundError("Route not found");

        const { priority, minAmount, maxAmount, isActive, currency } = req.body;

        await route.update({
            ...(priority !== undefined && { priority }),
            ...(minAmount !== undefined && { minAmount }),
            ...(maxAmount !== undefined && { maxAmount }),
            ...(isActive !== undefined && { isActive }),
            ...(currency && { currency: currency.toUpperCase() }),
        });

        res.json({ status: "success", data: route });
    })
);

/**
 * DELETE /api/admin/routes/:id
 * Delete a routing rule
 */
router.delete(
    "/routes/:id",
    auditLog("DELETE_ROUTE", "route"),
    catchAsync(async (req, res) => {
        const route = await ProviderRoute.findByPk(req.params.id);
        if (!route) throw new NotFoundError("Route not found");

        await route.destroy();
        res.json({ status: "success", message: "Route deleted" });
    })
);

// ══════════════════════════════════════════════════════════
// 📋 TRANSACTIONS
// ══════════════════════════════════════════════════════════

/**
 * GET /api/admin/transactions
 * Paginated, filterable transaction list
 * Query: ?status=&provider=&from=&to=&search=&page=&limit=
 */
router.get("/transactions", catchAsync(async (req, res) => {
    const {
        status, provider, from, to, search,
        page = 1, limit = 25, currency,
        lmsItemId, lmsItemType,
    } = req.query;

    const where = {};
    if (status) where.status = status;
    if (currency) where.currency = currency.toUpperCase();
    if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt[Op.gte] = new Date(from);
        if (to) where.createdAt[Op.lte] = new Date(to);
    }

    const orderWhere = {};
    if (search) {
        orderWhere[Op.or] = [
            { reference: { [Op.like]: `%${search}%` } },
            { customerEmail: { [Op.like]: `%${search}%` } },
        ];
    }
    if (lmsItemId) orderWhere.lmsItemId = lmsItemId;
    if (lmsItemType) orderWhere.lmsItemType = lmsItemType;

    const include = [
        {
            model: Order,
            as: "order",
            ...(Object.keys(orderWhere).length > 0 && { where: orderWhere }),
        },
        {
            model: PaymentProvider,
            as: "selectedProvider",
            ...(provider && { where: { code: provider } }),
        },
    ];

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await PaymentIntent.findAndCountAll({
        where,
        include,
        order: [["createdAt", "DESC"]],
        limit: parseInt(limit),
        offset,
        distinct: true,
    });

    res.json({
        status: "success",
        data: rows.map(i => ({
            id: i.id,
            status: i.status,
            amount: i.amount,
            currency: i.currency,
            provider: i.selectedProvider?.name || null,
            orderReference: i.order?.reference,
            orderId: i.order?.id,
            customerEmail: i.order?.customerEmail,
            createdAt: i.createdAt,
        })),
        meta: {
            total: count,
            page: parseInt(page),
            perPage: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
        },
    });
}));

/**
 * GET /api/admin/transactions/:transactionNumber
 * Full drilldown: intent + order + all attempts + related webhooks
 */
router.get("/transactions/:transactionNumber", catchAsync(async (req, res) => {
    const attempt = await PaymentAttempt.findOne({
        where: { transactionNumber: req.params.transactionNumber },
        include: [
            {
                model: PaymentIntent,
                as: "paymentIntent",
                include: [
                    { model: Order, as: "order" },
                    { model: PaymentProvider, as: "selectedProvider" },
                ],
            },
            { model: PaymentProvider, as: "provider" },
        ],
    });

    if (!attempt) throw new NotFoundError("Transaction not found");

    const intent = attempt.paymentIntent;

    // Get all attempts for this intent
    const allAttempts = await PaymentAttempt.findAll({
        where: { paymentIntentId: intent.id },
        include: [{ model: PaymentProvider, as: "provider" }],
        order: [["createdAt", "ASC"]],
    });

    res.json({
        status: "success",
        data: {
            intent: {
                id: intent.id,
                status: intent.status,
                amount: intent.amount,
                currency: intent.currency,
                selectedProvider: intent.selectedProvider?.name,
                idempotencyKey: intent.idempotencyKey,
                createdAt: intent.createdAt,
            },
            order: intent.order,
            attempts: allAttempts.map(a => ({
                id: a.id,
                transactionNumber: a.transactionNumber,
                provider: a.provider?.name,
                status: a.status,
                errorCode: a.errorCode,
                errorMessage: a.errorMessage,
                createdAt: a.createdAt,
            })),
        },
    });
}));

// ══════════════════════════════════════════════════════════
// 🔔 WEBHOOKS
// ══════════════════════════════════════════════════════════

/**
 * GET /api/admin/webhooks
 * Webhook event list + stats
 */
router.get("/webhooks", catchAsync(async (req, res) => {
    const { processed, provider, from, to, page = 1, limit = 50 } = req.query;
    const where = {};
    if (processed !== undefined) where.processed = processed === "true";
    if (provider) where.providerId = provider;
    if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt[Op.gte] = new Date(from);
        if (to) where.createdAt[Op.lte] = new Date(to);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [{ count, rows }, stats] = await Promise.all([
        WebhookEvent.findAndCountAll({
            where,
            include: [{ model: PaymentProvider, as: "provider" }],
            order: [["createdAt", "DESC"]],
            limit: parseInt(limit),
            offset,
        }),
        AnalyticsService.getWebhookStats(),
    ]);

    res.json({
        status: "success",
        data: rows.map(e => ({
            id: e.id,
            provider: e.provider?.name || "Unknown",
            eventType: e.eventType,
            signatureValid: e.signatureValid,
            processed: e.processed,
            processedAt: e.processedAt,
            retryCount: e.retryCount,
            createdAt: e.createdAt,
        })),
        stats,
        meta: {
            total: count,
            page: parseInt(page),
            perPage: parseInt(limit),
        },
    });
}));

/**
 * POST /api/admin/webhooks/:id/replay
 * Replay a webhook event that was not processed
 */
router.post(
    "/webhooks/:id/replay",
    auditLog("REPLAY_WEBHOOK", "webhook"),
    catchAsync(async (req, res) => {
        const event = await WebhookEvent.findByPk(req.params.id, {
            include: [{ model: PaymentProvider, as: "provider" }],
        });

        if (!event) throw new NotFoundError("Webhook event not found");

        if (event.processed) {
            return res.json({
                status: "fail",
                message: "This event was already successfully processed",
            });
        }

        const providerCode = event.provider?.code || "unknown";

        const result = await WebhookProcessor.processEvent(
            providerCode,
            event.payload,
            null // Signature validation already done originally
        );

        res.json({
            status: "success",
            message: `Webhook event #${event.id} replayed`,
            data: result,
        });
    })
);


// ══════════════════════════════════════════════════════════
// 🔔 NOTIFICATIONS & ALERTS
// ══════════════════════════════════════════════════════════

// Preferences (Email alerts)
router.get("/notifications/me", catchAsync(NotificationController.getMe));
router.get("/notifications", catchAsync(NotificationController.getSettings));
router.get("/notifications/search", catchAsync(NotificationController.searchAdmins));
router.post("/notifications", catchAsync(NotificationController.updateSetting));
router.delete("/notifications/:id", catchAsync(NotificationController.deleteSetting));

// In-App Alerts (Dashboard Bell)
router.get("/admin-notifications", catchAsync(AdminNotificationController.list));
router.put("/admin-notifications/:id/read", catchAsync(AdminNotificationController.markAsRead));
router.put("/admin-notifications/read-all", catchAsync(AdminNotificationController.markAllAsRead));

// ══════════════════════════════════════════════════════════
// 🔍 AUDIT LOGS
// ══════════════════════════════════════════════════════════

/**
 * GET /api/admin/audit-logs?page=&limit=&action=
 */
router.get("/audit-logs", catchAsync(async (req, res) => {
    const { page = 1, limit = 50, action } = req.query;
    const { AdminAuditLog } = await import("../models/admin-audit-log.model.js");
    const where = action ? { action } : {};

    const { count, rows } = await AdminAuditLog.findAndCountAll({
        where,
        order: [["created_at", "DESC"]],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({
        status: "success",
        data: rows,
        meta: { total: count, page: parseInt(page), perPage: parseInt(limit) },
    });
}));

// ═══════════════════════════════════════════════════════════
// 📋 ORDERS - Gestion du cycle de vie LMS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/admin/orders
 * Liste des commandes avec filtres
 */
router.get("/orders", catchAsync(async (req, res, next) => {
    await OrderController.list(req, res, next);
}));

/**
 * GET /api/admin/orders/:id
 * Détail d'une commande avec historique d'audit
 */
router.get("/orders/:id", catchAsync(async (req, res, next) => {
    await OrderController.getById(req, res, next);
}));

/**
 * POST /api/admin/orders/:id/validate
 * Valider ou rejeter une commande
 */
router.post(
    "/orders/:id/validate",
    auditLog("VALIDATE_ORDER", "order"),
    catchAsync(async (req, res, next) => {
        await OrderController.validate(req, res, next);
    })
);

/**
 * POST /api/admin/orders/:id/complete
 * Finaliser une commande - envoyer credentials
 */
router.post(
    "/orders/:id/complete",
    auditLog("COMPLETE_ORDER", "order"),
    catchAsync(async (req, res, next) => {
        await OrderController.complete(req, res, next);
    })
);

/**
 * GET /api/admin/orders/:id/audit
 * Historique d'audit d'une commande
 */
router.get("/orders/:id/audit", catchAsync(async (req, res, next) => {
    await OrderController.getAuditHistory(req, res, next);
}));

// ═══════════════════════════════════════════════════════════
// 🏢 COMPANIES & B2B MANAGEMENT
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/admin/companies
 * Liste toutes les entreprises clientes
 */
router.get("/companies", catchAsync(async (req, res, next) => {
    await AdminCompanyController.list(req, res, next);
}));

/**
 * GET /api/admin/companies/:id
 * Détail d'une entreprise avec ses admins et packages
 */
router.get("/companies/:id", catchAsync(async (req, res, next) => {
    await AdminCompanyController.getById(req, res, next);
}));

/**
 * PUT /api/admin/companies/admins/:adminId/toggle
 * Activer/Désactiver manuellement un admin entreprise
 */
router.put("/companies/admins/:adminId/toggle", catchAsync(async (req, res, next) => {
    await AdminCompanyController.toggleAdminStatus(req, res, next);
}));

export default router;
