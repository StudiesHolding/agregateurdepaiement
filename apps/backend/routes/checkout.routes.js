import { Router } from "express";
import { catchAsync } from "../middlewares/error.middleware.js";
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
