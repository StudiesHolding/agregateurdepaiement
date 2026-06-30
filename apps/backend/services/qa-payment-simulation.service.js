/**
 * Simulation professionnelle des webhooks PSP pour l'environnement ATDD.
 * Utilise le WebhookProcessor réel (pas de raccourci markAsSucceeded isolé).
 */
import { v4 as uuidv4 } from "uuid";
import { Order, PaymentIntent, PaymentAttempt } from "../models/index.js";
import { PaymentStatus } from "../enums/index.js";
import { WebhookProcessor } from "./webhook-processor.service.js";
import { waitForSagaJob } from "../saga/saga-sync.util.js";

export class QaPaymentSimulationService {
  /**
   * Simule un paiement réussi de bout en bout (webhook → saga si applicable).
   * @param {string} orderRef
   * @returns {Promise<{ orderRef: string, transactionNumber: string, saga?: object }>}
   */
  static async simulateSuccess(orderRef) {
    const order = await Order.findOne({ where: { reference: orderRef } });
    if (!order) {
      throw new Error(`Commande ${orderRef} introuvable`);
    }

    const transactionNumber = `QA-${order.reference}-${Date.now().toString(36)}`;

    let intent = await PaymentIntent.findOne({
      where: { orderId: order.id },
      order: [["created_at", "DESC"]],
    });

    if (!intent) {
      intent = await PaymentIntent.create({
        orderId: order.id,
        amount: order.totalAmount,
        currency: order.currency,
        status: PaymentStatus.PENDING,
        idempotencyKey: uuidv4(),
      });
    }

    let attempt = await PaymentAttempt.findOne({
      where: { paymentIntentId: intent.id },
      order: [["created_at", "DESC"]],
    });

    if (!attempt) {
      attempt = await PaymentAttempt.create({
        paymentIntentId: intent.id,
        providerId: 1,
        transactionNumber,
        status: "pending",
      });
    } else {
      await attempt.update({ transactionNumber, status: "pending" });
    }

    const payload = {
      cpm_trans_id: transactionNumber,
      cpm_result: "00",
      cpm_error_message: "SUCCES",
      event_type: "PAYMENT",
    };

    const result = await WebhookProcessor.processEvent("cinetpay", payload);

    const sagaResult =
      process.env.NODE_ENV === "test"
        ? await waitForSagaJob(orderRef, 30_000).catch(() => null)
        : null;

    return {
      orderRef,
      transactionNumber,
      webhook: result,
      saga: sagaResult,
    };
  }
}
