import Stripe from "stripe";
import { PaymentProviderInterface } from "../base/provider.interface.js";
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
                                name: `Order ${paymentData.orderReference || paymentData.orderId}`,
                            },
                            unit_amount: Math.round(paymentData.amount * 100), // Stripe uses cents
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
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
