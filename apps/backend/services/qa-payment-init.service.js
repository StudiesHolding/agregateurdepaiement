/**
 * Initialisation paiement QA — contourne le routage PSP (non requis en ATDD).
 */
import { OrderService } from "./order.service.js";
import { PaymentIntentService } from "./payment-intent.service.js";

export class QaPaymentInitService {
  static async initialize(data) {
    const {
      customerEmail,
      customerName,
      customerSurname,
      amount,
      currency = "XOF",
      metadata = {},
      lmsItemId,
      lmsItemType = "course",
      successUrl,
    } = data;

    const order = await OrderService.create({
      customerEmail,
      customerName,
      customerSurname,
      currency,
      totalAmount: amount,
      metadata,
      lmsItemId: lmsItemId || metadata.formation_id,
      lmsItemType,
      formationId: metadata.formation_id,
      formationName: metadata.formation_name,
      formationPrice: amount,
    });

    const intent = await PaymentIntentService.create({
      orderId: order.id,
      amount,
      currency,
      metadata,
    });

    const mockBase =
      process.env.QA_MOCK_CHECKOUT_URL || "http://localhost:3000/qa/checkout";

    return {
      success: true,
      orderReference: order.reference,
      orderRef: order.reference,
      reference: order.reference,
      paymentIntentId: String(intent.id),
      redirectUrl: `${mockBase}?order_ref=${encodeURIComponent(order.reference)}`,
      paymentUrl: `${mockBase}?order_ref=${encodeURIComponent(order.reference)}`,
      successUrl,
    };
  }
}
