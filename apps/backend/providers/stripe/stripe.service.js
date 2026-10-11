import Stripe from "stripe";
import { PaymentProviderInterface } from "../base/provider.interface.js";
import { toStripeAmount } from "../../services/payments/confirmation.js";
import { PaymentStatus } from "../../enums/index.js";

export class StripeService extends PaymentProviderInterface {
    /**
     * @param {Object} config 
     */
    constructor(config = {}) {
        super();
        this.secretKey = config.secretKey || process.env.STRIPE_SECRET_KEY;
        if (this.secretKey) {
            this.client = new Stripe(this.secretKey);
        }
    }

    async createPayment(paymentData) {
        if (!this.client) {
            return { success: false, error: "Stripe client not initialized" };
        }

        try {
            const session = await this.client.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: paymentData.currency.toLowerCase(),
                            product_data: {
                                name: paymentData.itemLabel || `Studies Learning · ${paymentData.orderReference || paymentData.orderId}`,
                            },
                            // Unités mineures, sauf devises sans décimales (XOF, XAF…) : 45 000 FCFA = 45000, pas 4 500 000.
                            unit_amount: toStripeAmount(paymentData.amount, paymentData.currency),
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                locale: 'fr',
                ...(paymentData.customerEmail ? { customer_email: paymentData.customerEmail } : {}),
                client_reference_id: paymentData.transactionNumber,
                success_url: paymentData.successUrl,
                cancel_url: paymentData.cancelUrl,
                metadata: {
                    orderId: paymentData.orderId,
                    paymentIntentId: paymentData.paymentIntentId,
                    transactionNumber: paymentData.transactionNumber
                },
            });

            return {
                success: true,
                transactionNumber: session.id,
                redirectUrl: session.url,
                status: PaymentStatus.REQUIRES_ACTION,
                response: session,
            };
        } catch (error) {
            return {
                success: false,
                errorCode: "STRIPE_CREATE_FAILED",
                errorMessage: error.message,
            };
        }
    }

    async checkStatus(transactionNumber) {
        try {
            const session = await this.client.checkout.sessions.retrieve(transactionNumber);
            return {
                success: true,
                status: this.mapStatus(session.payment_status),
                response: session,
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    mapStatus(stripeStatus) {
        switch (stripeStatus) {
            case "paid":
                return PaymentStatus.SUCCEEDED;
            case "unpaid":
                return PaymentStatus.PROCESSING;
            case "no_payment_required":
                return PaymentStatus.SUCCEEDED;
            default:
                return PaymentStatus.FAILED;
        }
    }

    validateWebhookSignature(payload, signature, webhookSecret) {
        try {
            this.client.webhooks.constructEvent(payload, signature, webhookSecret);
            return true;
        } catch (err) {
            return false;
        }
    }
}
