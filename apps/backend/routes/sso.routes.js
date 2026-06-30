import { Router } from "express";
import { catchAsync } from "../middlewares/error.middleware.js";
import { SsoActivationService } from "../services/sso-activation.service.js";

const router = Router();

/**
 * POST /api/v1/sso/activate
 * Active un compte via magic-link (B2C headless ou invitation collaborateur B2B).
 */
router.post(
  "/activate",
  catchAsync(async (req, res) => {
    const { token, email, password } = req.body;
    const result = await SsoActivationService.activate({ token, email, password });
    res.json({ status: "success", data: result });
  }),
);

export default router;
