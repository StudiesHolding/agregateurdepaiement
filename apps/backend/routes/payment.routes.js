import { Router } from "express";
import { PaymentController } from "../controllers/payment.controller.js";
import { catchAsync } from "../middlewares/error.middleware.js";
import { protect } from "../middlewares/auth.middleware.js";
import { emailVerificationMiddleware } from "../middlewares/email-verification.middleware.js";

const router = Router();

// Protect all routes in this router
router.use(protect);

router.post("/init", catchAsync(PaymentController.initialize));
router.post("/verify-email", catchAsync(PaymentController.verifyEmail));
router.post("/request-code", catchAsync(PaymentController.requestVerificationCode));
router.get("/:id/status", catchAsync(PaymentController.getStatus));

export default router;
