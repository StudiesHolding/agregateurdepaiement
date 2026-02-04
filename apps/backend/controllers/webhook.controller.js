import { WebhookProcessor } from "../services/index.js";
import { HttpStatus } from "../enums/index.js";

export class WebhookController {
  /**
   * Handle CinetPay Webhooks
   */
  static async cinetpay(req, res) {
    console.log("[Webhook] Received CinetPay notification");

    // Process async
    await WebhookProcessor.processEvent("cinetpay", req.body);

    res.status(HttpStatus.OK).send("OK");
  }

  /**
   * Handle Stripe Webhooks
   */
  static async stripe(req, res) {
    console.log("[Webhook] Received Stripe notification");

    const signature = req.headers["stripe-signature"];

    // Process async (In production we'd validate signature here)
    await WebhookProcessor.processEvent("stripe", req.body, signature);

    res.status(HttpStatus.OK).json({ received: true });
  }

  /**
   * Handle KKiaPay Webhooks
   */
  static async kkiapay(req, res) {
    console.log("[Webhook] Received KKiaPay notification");

    // KKiaPay sends signature in x-kkiapay-secret header
    const signature = req.headers["x-kkiapay-secret"];

    // Process async with signature for validation
    await WebhookProcessor.processEvent("kkiapay", req.body, signature);

    res.status(HttpStatus.OK).json({ received: true });
  }
}
