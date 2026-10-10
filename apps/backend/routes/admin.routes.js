import { Router } from "express";
import { catchAsync } from "../middlewares/error.middleware.js";
import { protectAdmin, auditLog, requirePsp } from "../middlewares/admin.middleware.js";
import { AnalyticsService } from "../services/analytics.service.js";
import {
    sequelize,
    PaymentProvider,
    PaymentIntent,
    PaymentAttempt,
    ProviderRoute,
    WebhookEvent,
    Order,
    Company,
    CompanyPackage,
    CompanyAdmin,
} from "../models/index.js";
import { ProviderFactory } from "../providers/index.js";
import { WebhookProcessor } from "../services/webhook-processor.service.js";
import { ProviderRouterService } from "../services/provider-router.service.js";
import { inMaintenance, normalizeRule } from "../services/routing/routing-engine.js";
import { PROVIDER_CATALOG, isImplemented, mergeSettings, readiness } from "../services/providers/provider-catalog.js";
import { failuresReport, revenueReport } from "../services/finance/finance-analytics.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";
import { Op } from "sequelize";
import { OrderController } from "../controllers/order.controller.js";
import { NotificationController } from "../controllers/notification.controller.js";
import { AdminNotificationController } from "../controllers/admin-notification.controller.js";
import { AdminCompanyController } from "../controllers/admin-company.controller.js";
import { AdminRequestController } from "../controllers/admin-request.controller.js";

const router = Router();

// Toute l'administration exige une session d'équipe (permission psp.view au moins) ou une clé d'intégration
// administrateur ; chaque action qui modifie quelque chose exige en plus sa permission (ADR-0018, D5.2).
router.use(protectAdmin, requirePsp("psp.view"));

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

/* GET /api/admin/kpis/lms retiré (ADR-0019) : lisait les portefeuilles du backend métier ; remplacé par /finance/revenue. */


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
 * GET /api/admin/providers?period=24h
 * Fiche de chaque prestataire (ADR-0019, D3) : santé sur la période, préparation technique (identifiants présents,
 * jamais leur valeur), état (actif, maintenance), barème de frais, délai de reversement, couverture.
 */
const providerView = (p, stats = {}, rules = []) => {
    const ready = readiness(p.code);
    const maint = inMaintenance(p);
    const meta = p.metadata ?? {};
    let healthStatus = stats.healthStatus ?? (p.isActive ? "idle" : "inactive");
    if (!ready.implemented || !ready.ready) healthStatus = "not_configured";
    else if (maint) healthStatus = "maintenance";
    return {
        id: p.id, code: p.code, name: p.name, isActive: p.isActive, supportCard: p.supportCard, supportMobileMoney: p.supportMobileMoney,
        inMaintenance: maint, maintenance: meta.maintenance ?? { active: false }, fees: meta.fees ?? {}, settlementDays: meta.settlementDays ?? null, note: meta.note ?? null,
        readiness: ready,
        stats: {
            totalAttempts: Number(stats.totalAttempts ?? 0), successCount: Number(stats.successCount ?? 0), failureCount: Number(stats.failureCount ?? 0),
            successRate: stats.totalAttempts ? Number(stats.successRate) : null, healthStatus,
        },
        coverage: {
            rules: rules.length, activeRules: rules.filter((r) => r.isActive).length,
            countries: Array.from(new Set(rules.map((r) => r.countryCode))).sort(),
            currencies: Array.from(new Set(rules.map((r) => r.currency))).sort(),
        },
        updatedAt: p.updatedAt,
    };
};

router.get("/providers", catchAsync(async (req, res) => {
    const { period = "24h" } = req.query;
    const [perf, providers, routes] = await Promise.all([
        AnalyticsService.getProviderPerformance(period),
        PaymentProvider.findAll({ order: [["name", "ASC"]] }),
        ProviderRoute.findAll(),
    ]);
    const data = providers.map((p) => providerView(p, perf.find((x) => Number(x.providerId) === Number(p.id)), routes.filter((r) => Number(r.providerId) === Number(p.id))));
    res.json({ status: "success", data });
}));

/**
 * GET /api/admin/providers/catalog
 * Prestataires que l'agrégateur sait réellement utiliser, avec leur préparation technique.
 */
router.get("/providers/catalog", catchAsync(async (req, res) => {
    const existing = new Set((await PaymentProvider.findAll({ attributes: ["code"] })).map((p) => p.code.toLowerCase()));
    const data = Object.entries(PROVIDER_CATALOG).map(([code, def]) => ({ code, name: def.name, methods: def.methods, registered: existing.has(code), readiness: readiness(code) }));
    res.json({ status: "success", data });
}));

/** Ancienne route, conservée pour compatibilité : codes réellement implémentés. */
router.get("/providers/factory-codes", catchAsync(async (req, res) => {
    res.json({ status: "success", data: Object.keys(PROVIDER_CATALOG) });
}));

/**
 * GET /api/admin/providers/:id/sparkline
 * Taux de succès horaire sur 48 h.
 */
router.get("/providers/:id/sparkline", catchAsync(async (req, res) => {
    const data = await AnalyticsService.getProviderSparkline(req.params.id);
    res.json({ status: "success", data });
}));

/**
 * GET /api/admin/providers/:id/errors?period=24h
 * Erreurs les plus fréquentes du prestataire.
 */
router.get("/providers/:id/errors", catchAsync(async (req, res) => {
    const { period = "24h" } = req.query;
    const data = await AnalyticsService.getProviderTopErrors(req.params.id, period);
    res.json({ status: "success", data });
}));

const refuseCredentials = (body) => {
    if (body && (body.credentials !== undefined || body.credentialsEncrypted !== undefined)) {
        throw new BadRequestError("Les identifiants d’un prestataire se configurent dans l’environnement du serveur, jamais depuis le tableau de bord.");
    }
};

/**
 * POST /api/admin/providers
 * Inscrit un prestataire IMPLÉMENTÉ (catalogue). Créé désactivé : on l'active une fois prêt et routé.
 */
router.post(
    "/providers",
    auditLog("CREATE_PROVIDER", "provider"),
    requirePsp("psp.providers.manage"),
    catchAsync(async (req, res) => {
        refuseCredentials(req.body);
        const code = String(req.body?.code ?? "").toLowerCase().trim();
        if (!isImplemented(code)) throw new BadRequestError("Ce prestataire n’est pas implémenté dans l’agrégateur.");
        if (await PaymentProvider.findOne({ where: { code } })) throw new BadRequestError("Ce prestataire est déjà inscrit.");
        const def = PROVIDER_CATALOG[code];
        let metadata;
        try { metadata = mergeSettings({}, req.body ?? {}); } catch (err) { throw new BadRequestError(err.message); }
        const provider = await PaymentProvider.create({
            code, name: String(req.body?.name ?? def.name).trim().slice(0, 100) || def.name,
            supportCard: def.methods.includes("card"), supportMobileMoney: def.methods.includes("mobile_money"),
            isActive: false, credentialsEncrypted: null, metadata,
        });
        res.status(201).json({ status: "success", data: providerView(provider) });
    })
);

/**
 * PUT /api/admin/providers/:id
 * Réglages : nom, moyens proposés, maintenance, barème de frais, délai de reversement, note.
 */
router.put(
    "/providers/:id",
    auditLog("UPDATE_PROVIDER", "provider"),
    requirePsp("psp.providers.manage"),
    catchAsync(async (req, res) => {
        refuseCredentials(req.body);
        const provider = await PaymentProvider.findByPk(req.params.id);
        if (!provider) throw new NotFoundError("Prestataire introuvable.");
        const { name, supportCard, supportMobileMoney } = req.body ?? {};
        let metadata;
        try { metadata = mergeSettings(provider.metadata ?? {}, req.body ?? {}); } catch (err) { throw new BadRequestError(err.message); }
        await provider.update({
            ...(typeof name === "string" && name.trim() && { name: name.trim().slice(0, 100) }),
            ...(supportCard !== undefined && { supportCard: !!supportCard }),
            ...(supportMobileMoney !== undefined && { supportMobileMoney: !!supportMobileMoney }),
            metadata,
        });
        res.json({ status: "success", data: providerView(provider) });
    })
);

/**
 * PUT /api/admin/providers/:id/toggle
 * Active ou désactive. Un prestataire sans identifiants ne peut pas être activé.
 */
router.put(
    "/providers/:id/toggle",
    auditLog("TOGGLE_PROVIDER", "provider"),
    requirePsp("psp.providers.manage"),
    catchAsync(async (req, res) => {
        const provider = await PaymentProvider.findByPk(req.params.id);
        if (!provider) throw new NotFoundError("Prestataire introuvable.");
        if (!provider.isActive) {
            const r = readiness(provider.code);
            if (!r.implemented) throw new BadRequestError("Prestataire non implémenté : activation impossible.");
            if (!r.ready) throw new BadRequestError(`Identifiants manquants dans l’environnement du serveur : ${r.credentials.filter((c) => !c.present).map((c) => c.env).join(", ")}.`);
        }
        await provider.update({ isActive: !provider.isActive });
        res.json({ status: "success", data: providerView(provider), message: provider.isActive ? `${provider.name} est activé.` : `${provider.name} est désactivé.` });
    })
);

/**
 * POST /api/admin/providers/:id/test
 * Contrôle de préparation : identifiants présents, adaptateur instanciable.
 */
router.post("/providers/:id/test", auditLog("TEST_PROVIDER", "provider"), requirePsp("psp.providers.manage"), catchAsync(async (req, res) => {
    const provider = await PaymentProvider.findByPk(req.params.id);
    if (!provider) throw new NotFoundError("Prestataire introuvable.");
    const r = readiness(provider.code);
    const checks = [
        { label: "Prestataire implémenté dans l’agrégateur", ok: r.implemented },
        ...r.credentials.map((c) => ({ label: `${c.label} (${c.env})`, ok: c.present })),
    ];
    if (r.implemented && r.ready) {
        try { ProviderFactory.getProvider(provider.code); checks.push({ label: "Adaptateur initialisé", ok: true }); }
        catch (err) { checks.push({ label: "Adaptateur initialisé", ok: false, detail: err.message }); }
    }
    const ok = checks.every((c) => c.ok);
    res.json({ status: ok ? "success" : "fail", data: { ok, checks, mode: r.mode }, message: ok ? `${provider.name} est prêt.` : `${provider.name} n’est pas prêt.` });
}));

// ══════════════════════════════════════════════════════════
// 💰 FINANCE (ADR-0019, D4-D5)
// ══════════════════════════════════════════════════════════

/**
 * GET /api/admin/finance/revenue?range=30d|from=&to=&ref=XOF
 * Provenance des revenus : brut, frais estimés, net ; par pays, prestataire, moyen, produit, canal ; série par jour.
 */
router.get("/finance/revenue", catchAsync(async (req, res) => {
    try { res.json({ status: "success", data: await revenueReport(req.query) }); }
    catch (err) { if (/Période/.test(err.message)) throw new BadRequestError(err.message); throw err; }
}));

/**
 * GET /api/admin/finance/failures?range=30d|from=&to=&ref=XOF
 * Entonnoir du canal de paiement, abandons, échecs classés et expliqués, par prestataire, pays et moyen.
 */
router.get("/finance/failures", catchAsync(async (req, res) => {
    try { res.json({ status: "success", data: await failuresReport(req.query) }); }
    catch (err) { if (/Période/.test(err.message)) throw new BadRequestError(err.message); throw err; }
}));

// ══════════════════════════════════════════════════════════
// 🌍 ROUTING RULES
// ══════════════════════════════════════════════════════════

/**
 * GET /api/admin/routes
 * Règles de priorité avec leur prestataire (ADR-0019, D2).
 */
const ruleView = (r) => ({
    id: r.id,
    provider: r.provider ? { id: r.provider.id, name: r.provider.name, code: r.provider.code, isActive: r.provider.isActive, inMaintenance: inMaintenance(r.provider) } : null,
    countryCode: r.countryCode,
    currency: r.currency,
    paymentMethod: r.paymentMethod ?? "any",
    minAmount: r.minAmount === null ? null : Number(r.minAmount),
    maxAmount: r.maxAmount === null ? null : Number(r.maxAmount),
    priority: r.priority,
    isActive: r.isActive,
    updatedAt: r.updatedAt,
});

router.get("/routes", catchAsync(async (req, res) => {
    const routes = await ProviderRouterService.loadRules();
    res.json({ status: "success", data: routes.map(ruleView) });
}));

/**
 * GET /api/admin/routes/matrix
 * Couverture : pays × devise × moyen → prestataires dans l'ordre d'essai.
 */
router.get("/routes/matrix", catchAsync(async (req, res) => {
    const routes = await ProviderRouterService.loadRules();
    const providers = await PaymentProvider.findAll({ order: [["name", "ASC"]] });
    const lanes = {};
    for (const r of routes) {
        const key = `${r.countryCode}|${r.currency}|${r.paymentMethod ?? "any"}`;
        (lanes[key] ??= { countryCode: r.countryCode, currency: r.currency, paymentMethod: r.paymentMethod ?? "any", rules: [] }).rules.push(ruleView(r));
    }
    res.json({
        status: "success",
        data: {
            lanes: Object.values(lanes).sort((a, b) => a.countryCode.localeCompare(b.countryCode) || a.currency.localeCompare(b.currency)),
            providers: providers.map((p) => ({ id: p.id, name: p.name, code: p.code, isActive: p.isActive, supportCard: p.supportCard, supportMobileMoney: p.supportMobileMoney, inMaintenance: inMaintenance(p) })),
        },
    });
}));

/**
 * POST /api/admin/routes/simulate
 * Décision expliquée pour une demande : prestataire choisi, bascules, et motif pour chaque règle écartée.
 * body: { countryCode, currency, amount, paymentMethod }
 */
router.post("/routes/simulate", catchAsync(async (req, res) => {
    let result;
    try {
        result = await ProviderRouterService.explain(req.body ?? {});
    } catch (err) {
        throw new BadRequestError(err.message);
    }
    const chain = result.candidates.map((c) => ({
        position: c.position, ruleId: c.rule.id, providerId: c.rule.provider.id, providerName: c.rule.provider.name,
        providerCode: c.rule.provider.code, priority: c.rule.priority, why: c.why,
    }));
    res.json({
        status: "success",
        data: { input: result.request, selectedProvider: chain[0] ?? null, fallbackChain: chain.slice(1), totalCandidates: chain.length, trace: result.trace },
    });
}));

/**
 * POST /api/admin/routes
 * Nouvelle règle (validation stricte : pays ISO ou « * », devise ISO, moyen, tranche, priorité).
 */
router.post(
    "/routes",
    auditLog("CREATE_ROUTE", "route"),
    requirePsp("psp.providers.manage"),
    catchAsync(async (req, res) => {
        const provider = await PaymentProvider.findByPk(req.body?.providerId);
        if (!provider) throw new BadRequestError("Prestataire introuvable.");
        let fields;
        try { fields = normalizeRule(req.body ?? {}); } catch (err) { throw new BadRequestError(err.message); }
        const route = await ProviderRoute.create({ providerId: provider.id, ...fields, isActive: fields.isActive ?? true });
        route.provider = provider;
        res.status(201).json({ status: "success", data: ruleView(route) });
    })
);

/**
 * PUT /api/admin/routes/:id
 * Modification partielle d'une règle (dont l'ordre de priorité).
 */
router.put(
    "/routes/:id",
    auditLog("UPDATE_ROUTE", "route"),
    requirePsp("psp.providers.manage"),
    catchAsync(async (req, res) => {
        const route = await ProviderRoute.findByPk(req.params.id, { include: [{ model: PaymentProvider, as: "provider" }] });
        if (!route) throw new NotFoundError("Règle introuvable.");
        let fields;
        try {
            fields = normalizeRule({ minAmount: route.minAmount, maxAmount: route.maxAmount, ...req.body }, { partial: true });
        } catch (err) { throw new BadRequestError(err.message); }
        await route.update(fields);
        res.json({ status: "success", data: ruleView(route) });
    })
);

/**
 * PUT /api/admin/routes-order
 * Nouvel ordre d'essai pour une voie (pays × devise × moyen) : priorités réécrites 10, 20, 30…
 * body: { ruleIds: number[] }
 */
router.put(
    "/routes-order",
    auditLog("REORDER_ROUTES", "route"),
    requirePsp("psp.providers.manage"),
    catchAsync(async (req, res) => {
        const ids = Array.isArray(req.body?.ruleIds) ? req.body.ruleIds.map(Number).filter(Number.isInteger) : [];
        if (ids.length < 2 || new Set(ids).size !== ids.length) throw new BadRequestError("Liste de règles invalide.");
        const rules = await ProviderRoute.findAll({ where: { id: { [Op.in]: ids } } });
        if (rules.length !== ids.length) throw new BadRequestError("Une des règles n'existe plus.");
        await sequelize.transaction(async (t) => {
            for (const [i, id] of ids.entries()) await ProviderRoute.update({ priority: (i + 1) * 10 }, { where: { id }, transaction: t });
        });
        res.json({ status: "success", data: ids.map((id, i) => ({ id, priority: (i + 1) * 10 })) });
    })
);

/**
 * DELETE /api/admin/routes/:id
 */
router.delete(
    "/routes/:id",
    auditLog("DELETE_ROUTE", "route"),
    requirePsp("psp.providers.manage"),
    catchAsync(async (req, res) => {
        const route = await ProviderRoute.findByPk(req.params.id);
        if (!route) throw new NotFoundError("Règle introuvable.");
        await route.destroy();
        res.json({ status: "success", message: "Règle supprimée." });
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
    requirePsp("psp.operations.manage"),
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
router.post("/notifications", auditLog("UPDATE_NOTIFICATION_SETTING", "notification"), requirePsp("psp.operations.manage"), catchAsync(NotificationController.updateSetting));
router.delete("/notifications/:id", auditLog("DELETE_NOTIFICATION_SETTING", "notification"), requirePsp("psp.operations.manage"), catchAsync(NotificationController.deleteSetting));

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
    requirePsp("psp.operations.manage"),
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
    requirePsp("psp.operations.manage"),
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

/**
 * GET /api/admin/orders/:id/provisioning
 * Retourne le statut du provisioning B2B pour une commande
 */
router.get("/orders/:id/provisioning", catchAsync(async (req, res) => {
    const { id } = req.params;

    const order = await Order.findByPk(id);
    if (!order) {
        throw new NotFoundError("Commande non trouvée");
    }

    const metadata = order.metadata || {};
    const isB2B = metadata.is_b2b === true || metadata.b2b_purchase === true;

    if (!isB2B) {
        return res.json({
            status: "success",
            data: {
                isB2B: false,
                message: "Cette commande n'est pas un achat B2B"
            }
        });
    }

    // Chercher la company associée
    let company = null;
    let admin = null;
    let companyPackages = [];

    if (metadata.company_id) {
        company = await Company.findByPk(metadata.company_id);
    } else {
        // Chercher par email admin
        const adminEmail = metadata.company_admin_email || order.customerEmail;
        admin = await CompanyAdmin.findOne({ where: { email: adminEmail } });
        if (admin) {
            company = await Company.findByPk(admin.company_id);
            admin = await CompanyAdmin.findAll({ where: { company_id: admin.company_id } });
            companyPackages = await CompanyPackage.findAll({
                where: { company_id: admin.company_id },
                order: [["purchase_date", "DESC"]]
            });
        }
    }

    res.json({
        status: "success",
        data: {
            isB2B: true,
            provisioning: {
                status: company ? "completed" : "pending",
                companyId: company?.id || null,
                companyName: company?.name || metadata.company_name || "Entreprise",
                companyEmail: company?.email || metadata.company_admin_email || order.customerEmail,
                industry: company?.metadata?.industry || metadata.company_industry || null,
                totalLicenses: metadata.total_licenses || metadata.licence_count || 1,
                adminCount: admin ? (Array.isArray(admin) ? admin.length : 1) : 0,
                packagesCount: companyPackages.length,
                createdAt: company?.created_at || null,
            }
        }
    });
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
router.put("/companies/admins/:adminId/toggle", auditLog("TOGGLE_COMPANY_ADMIN", "company_admin"), requirePsp("psp.companies.manage"), catchAsync(async (req, res, next) => {
    await AdminCompanyController.toggleAdminStatus(req, res, next);
}));

// ═══════════════════════════════════════════════════════════
// 📋 ACCESS REQUESTS - Gestion des demandes d'accès B2B
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/admin/requests
 * Liste toutes les demandes d'accès (toutes entreprises)
 */
router.get("/requests", catchAsync(async (req, res, next) => {
    await AdminRequestController.getAll(req, res, next);
}));

/**
 * GET /api/admin/requests/:id
 * Détail d'une demande d'accès
 */
router.get("/requests/:id", catchAsync(async (req, res, next) => {
    await AdminRequestController.getById(req, res, next);
}));

/**
 * POST /api/admin/requests/:id/approve
 * Approuver une demande et créer les credentials LMS
 */
router.post(
    "/requests/:id/approve",
    auditLog("APPROVE_REQUEST", "access_request"),
    requirePsp("psp.companies.manage"),
    catchAsync(async (req, res, next) => {
        await AdminRequestController.approve(req, res, next);
    })
);

/**
 * POST /api/admin/requests/batch-approve
 * Approuver plusieurs demandes à la fois
 */
router.post(
    "/requests/batch-approve",
    auditLog("BATCH_APPROVE_REQUESTS", "access_request"),
    requirePsp("psp.companies.manage"),
    catchAsync(async (req, res, next) => {
        await AdminRequestController.batchApprove(req, res, next);
    })
);

/**
 * POST /api/admin/requests/:id/reject
 * Rejeter une demande d'accès
 */
router.post(
    "/requests/:id/reject",
    auditLog("REJECT_REQUEST", "access_request"),
    requirePsp("psp.companies.manage"),
    catchAsync(async (req, res, next) => {
        await AdminRequestController.reject(req, res, next);
    })
);

/**
 * POST /api/admin/requests/batch-reject
 * Rejeter plusieurs demandes à la fois
 */
router.post(
    "/requests/batch-reject",
    auditLog("BATCH_REJECT_REQUESTS", "access_request"),
    requirePsp("psp.companies.manage"),
    catchAsync(async (req, res, next) => {
        await AdminRequestController.batchReject(req, res, next);
    })
);

export default router;
