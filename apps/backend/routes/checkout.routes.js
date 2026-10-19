import { Router } from "express";
import { catchAsync } from "../middlewares/error.middleware.js";
import rateLimit from "express-rate-limit";
import { checkoutContextService } from "../services/purchase-engine/checkout-context.service.js";
import { ProviderRouterService } from "../services/provider-router.service.js";
import { Order, PaymentIntent, PaymentAttempt } from "../models/index.js";
import { customerReason } from "../services/finance/failure-taxonomy.js";
import { purchaseKind } from "../utils/purchase-labels.js";
import { parseJson } from "../utils/json-column.js";

// Note: Ensure the strategies are registered elsewhere (e.g. at startup)
// import { B2bPackagePurchaseStrategy } from "../services/purchase-engine/b2b-package.strategy.js";
// checkoutContextService.registerStrategy(new B2bPackagePurchaseStrategy());

const router = Router();

/**
 * GET /api/checkout/context
 * Retrieves UI context and product info based on purchase type and ID.
 * Query Params: ?type=B2B_PACKAGE&id=5
 */
router.get("/context", catchAsync(async (req, res) => {
    const { type, id } = req.query;
    
    if (!type || !id) {
        return res.status(400).json({ success: false, message: "Type and ID are required." });
    }

    // Enchère : le jeton d'invitation (lien reçu par e-mail) désigne la personne et le montant (ADR-0021, D4).
    const claim = typeof req.query.claim === "string" ? req.query.claim : undefined;
    const context = await checkoutContextService.getContext(type, id, { claim });
    
    res.json({
        success: true,
        data: context
    });
}));

/**
 * GET /api/checkout/quote
 * Server-side quote for an offer sold per licence (B2B_PACKAGE, B2B_THEMATIQUE).
 * Query Params: ?type=B2B_PACKAGE&id=5&seats=25
 * The amount paid at /process is recomputed from the same quote: this endpoint is for display only.
 */
router.get("/quote", catchAsync(async (req, res) => {
    const { type, id, seats } = req.query;

    if (!type || !id) {
        return res.status(400).json({ success: false, message: "Type and ID are required." });
    }

    const quote = await checkoutContextService.getQuote(type, id, seats);

    res.json({
        success: true,
        data: quote
    });
}));

// Anti essai de codes (ADR-0012, D9) : 10 vérifications par minute et par adresse IP.
const couponLimiter = process.env.NODE_ENV === "test"
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs: 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: "Trop d'essais de codes : patientez une minute." },
    });

/**
 * POST /api/checkout/coupon
 * Aperçu d'un code sur une formation (aucune réservation) : prix avant/après, ou refus motivé.
 * Body: { type: "B2C_COURSE", id: 58, code: "RENTREE-2026", email?: "..." }
 */
router.post("/coupon", couponLimiter, catchAsync(async (req, res) => {
    const { type, id, code, email } = req.body ?? {};
    if (type !== "B2C_COURSE") {
        return res.status(400).json({ success: false, message: "Les codes s'appliquent aux inscriptions à une formation." });
    }
    if (!id || typeof code !== "string" || !code.trim()) {
        return res.status(400).json({ success: false, message: "Formation et code requis." });
    }
    const strategy = checkoutContextService.getStrategy(type);
    const data = await strategy.previewCoupon(id, code, typeof email === "string" ? email : null);
    res.json({ success: true, data });
}));

/**
 * POST /api/checkout/process
 * Initiates the payment process with the chosen strategy.
 * Body: { type: "B2B_PACKAGE", data: { itemId: 5, ... } }
 */
router.post("/process", catchAsync(async (req, res) => {
    const { type, data } = req.body;
    // req.user would come from an auth middleware if the user is logged in
    const user = req.user || null;

    if (!type || !data) {
        return res.status(400).json({ success: false, message: "Type and payload data are required." });
    }

    const result = await checkoutContextService.processCheckout(type, data, user);
    
    res.json({
        success: true,
        data: result
    });
}));

/**
 * GET /api/checkout/methods?currency=XOF&country=SN&amount=45000
 * Moyens de paiement réellement disponibles pour cette devise et ce pays (règles de priorité, ADR-0019 D2) :
 * le checkout ne propose jamais un moyen qui ne passerait pas. Aucune information sensible (ni prestataire, ni règle).
 */
router.get("/methods", catchAsync(async (req, res) => {
    const currency = String(req.query.currency ?? "").toUpperCase();
    const country = String(req.query.country ?? "").toUpperCase();
    const amount = Number(req.query.amount ?? 1) || 1;
    if (!/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ success: false, message: "Devise invalide." });
    const methods = [];
    for (const method of ["mobile_money", "card"]) {
        try {
            const { candidates } = await ProviderRouterService.explain({ countryCode: /^[A-Z]{2}$/.test(country) ? country : "", currency, amount, paymentMethod: method });
            methods.push({ method, available: candidates.length > 0, fallback: candidates.length > 1 });
        } catch {
            methods.push({ method, available: false, fallback: false });
        }
    }
    res.json({ success: true, data: { currency, country: /^[A-Z]{2}$/.test(country) ? country : null, methods } });
}));

/**
 * GET /api/checkout/status?ref=INS-…
 * Suivi d'un achat pour les pages de retour : état, nature, montant. La référence (horodatage + aléa) sert de jeton ;
 * aucune donnée personnelle n'est renvoyée.
 */
router.get("/status", catchAsync(async (req, res) => {
    const ref = String(req.query.ref ?? "");
    if (!/^[A-Z]{2,4}-[A-Z0-9-]{6,40}$/.test(ref)) return res.status(400).json({ success: false, message: "Référence invalide." });
    const order = await Order.findOne({ where: { reference: ref } });
    if (!order) return res.status(404).json({ success: false, message: "Achat introuvable." });
    const intent = await PaymentIntent.findOne({ where: { orderId: order.id }, order: [["id", "DESC"]] });
    const s = order.status;
    const state = ["completed", "validated"].includes(s) ? "delivered"
        : s === "payment_confirmed" ? "confirmed"
        : ["payment_failed", "rejected", "cancelled", "expired"].includes(s) || intent?.status === "failed" ? "failed"
        : "pending";
    // Échec : motif compris par l'acheteur, tiré de la dernière tentative (jamais la réponse brute du prestataire).
    let reason = null;
    if (state === "failed" && intent) {
        const attempt = await PaymentAttempt.findOne({ where: { paymentIntentId: intent.id }, order: [["id", "DESC"]] });
        reason = customerReason({ errorCode: attempt?.errorCode, errorMessage: attempt?.errorMessage, status: attempt?.status });
    }
    res.json({
        success: true,
        data: {
            reference: order.reference, state, kind: purchaseKind(order), reason,
            formationId: Number(parseJson(order.metadata)?.formation_id ?? order.formationId) || null,
            title: order.formationName ?? (parseJson(order.metadata)?.formation_name || parseJson(order.metadata)?.company_name || null),
            amount: Number(order.totalAmount), currency: order.currency,
            paidAt: order.paidAt ?? null,
        },
    });
}));

export default router;
