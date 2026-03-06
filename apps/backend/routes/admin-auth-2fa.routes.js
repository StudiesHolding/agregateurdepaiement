import { Router } from "express";
import { AdminAuth2FAController } from "../controllers/admin-auth-2fa.controller.js";
import { catchAsync } from "../middlewares/error.middleware.js";

const router = Router();

router.post("/init", catchAsync(AdminAuth2FAController.init));
router.post("/verify", catchAsync(AdminAuth2FAController.verify));

export default router;
