import { Router } from "express";
import { catchAsync } from "../middlewares/error.middleware.js";
import rateLimit from "express-rate-limit";
import { checkoutContextService } from "../services/purchase-engine/checkout-context.service.js";

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

    const context = await checkoutContextService.getContext(type, id);
    
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

export default router;
