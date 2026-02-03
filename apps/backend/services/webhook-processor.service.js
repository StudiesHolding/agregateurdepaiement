import { WebhookEvent, PaymentIntent, PaymentAttempt, Order, sequelize } from "../models/index.js";
import { PaymentStatus, AttemptStatus } from "../enums/index.js";
import { ProviderFactory } from "../providers/index.js";
import { MailService } from "./mail.service.js";

export class WebhookProcessor {
    /**
     * Record and process a webhook event
     */
    static async processEvent(providerCode, payload, signature = null) {
        let transaction = null;
        let notificationData = null;

        try {
            transaction = await sequelize.transaction();

            // 1. Log the raw event
            const event = await WebhookEvent.create({
                eventType: payload.event_type || payload.code || 'unknown',
                payload: payload,
                signatureValid: true,
                processed: false
            }, { transaction });

            // 2. Identify transaction
            let transactionNumber = null;
            if (providerCode === 'cinetpay') {
                transactionNumber = payload.cpm_trans_id || payload.client_transaction_id;
            } else if (providerCode === 'stripe') {
                const stripeObj = payload.data?.object;
                transactionNumber = stripeObj?.metadata?.transactionNumber ||
                    stripeObj?.client_reference_id ||
                    stripeObj?.id;
            }

            if (transactionNumber) {
                console.log(`[WebhookProcessor] Processing transaction: ${transactionNumber}`);

                // Find the attempt with Intent and Order
                const attempt = await PaymentAttempt.findOne({
                    where: { transactionNumber },
                    include: [{
                        model: PaymentIntent,
                        as: 'paymentIntent',
                        include: [{ model: Order, as: 'order' }]
                    }]
                }, { transaction });

                if (attempt && attempt.paymentIntent && attempt.paymentIntent.order) {
                    console.log(`[WebhookProcessor] Found attempt for Order: ${attempt.paymentIntent.order.reference}`);
                    event.providerId = attempt.providerId;
                    const intent = attempt.paymentIntent;
                    const order = intent.order;

                    // Professional Verification Flow
                    let finalStatus = null;
                    let providerResponse = payload;

                    if (providerCode === 'cinetpay') {
                        // Anti-MitM: Call CinetPay API to verify the real status
                        console.log(`[WebhookProcessor] Verifying CinetPay Tx: ${transactionNumber}`);
                        const cinetpay = ProviderFactory.getProvider('cinetpay');
                        const verification = await cinetpay.checkStatus(transactionNumber);

                        if (verification.success) {
                            console.log(`[WebhookProcessor] CinetPay verification: ${verification.status}`);
                            finalStatus = verification.status;
                            providerResponse = verification.response;
                        } else {
                            console.warn(`[WebhookProcessor] CinetPay verification FAILED for ${transactionNumber}: ${verification.errorMessage || 'Unknown error'}`);
                        }
                    } else {
                        // For other providers, we map from the validated payload
                        if (this.isSuccessEvent(providerCode, payload)) finalStatus = PaymentStatus.SUCCEEDED;
                        else if (this.isFailureEvent(providerCode, payload)) finalStatus = PaymentStatus.FAILED;
                    }

                    if (finalStatus === PaymentStatus.SUCCEEDED) {
                        await this.markAsSucceeded(attempt, providerResponse, transaction);
                        notificationData = { type: 'success', intent, order };
                    } else if (finalStatus === PaymentStatus.FAILED) {
                        await this.markAsFailed(attempt, providerResponse, transaction);
                        notificationData = { type: 'failure', intent, order, reason: providerResponse.message || 'Payment failed' };
                    } else if (finalStatus === PaymentStatus.PROCESSING) {
                        await this.markAsProcessing(attempt, providerResponse, transaction);
                        console.log(`[WebhookProcessor] Payment is still processing/waiting for: ${transactionNumber}`);
                    }

                    event.processed = true;
                    event.processedAt = new Date();
                } else {
                    console.warn(`[WebhookProcessor] No payment attempt found for ID: ${transactionNumber}`);
                    console.log("💡 Tip: Webhooks use the Transaction Number (TXN-...), not the Order Reference (ORD-...).");
                }
            }

            await event.save({ transaction });
            await transaction.commit();

            // Trigger notifications AFTER commit to ensure data integrity
            if (notificationData) {
                if (notificationData.type === 'success') {
                    await MailService.sendPaymentSuccessNotification(notificationData.intent, notificationData.order);
                    await MailService.sendAdminNotification(
                        `Nouveau paiement reçu - ${notificationData.order.reference}`,
                        `Un paiement de ${notificationData.intent.amount} ${notificationData.intent.currency} a été confirmé pour ${notificationData.order.customerName}.`
                    );
                } else {
                    await MailService.sendPaymentFailureNotification(notificationData.intent, notificationData.order, notificationData.reason);
                }
            }

            return { success: true, eventId: event.id };
        } catch (error) {
            if (transaction) await transaction.rollback();
            console.error(`[WebhookProcessor] Error processing ${providerCode} event:`, error);
            throw error;
        }
    }

    static isSuccessEvent(provider, payload) {
        if (provider === 'cinetpay') return payload.cpm_result === '00';
        if (provider === 'stripe') return payload.type === 'payment_intent.succeeded';
        return false;
    }

    static isFailureEvent(provider, payload) {
        if (provider === 'cinetpay') return payload.cpm_result !== '00' && payload.cpm_result !== 'waiting';
        if (provider === 'stripe') return payload.type === 'payment_intent.payment_failed';
        return false;
    }

    static async markAsSucceeded(attempt, payload, transaction) {
        await attempt.update({
            status: AttemptStatus.SUCCEEDED,
            responsePayload: payload
        }, { transaction });

        await PaymentIntent.update({
            status: PaymentStatus.SUCCEEDED
        }, {
            where: { id: attempt.paymentIntentId },
            transaction
        });
    }

    static async markAsFailed(attempt, payload, transaction) {
        await attempt.update({
            status: AttemptStatus.FAILED,
            responsePayload: payload,
            errorMessage: payload.message || 'Payment failed via webhook'
        }, { transaction });
    }

    static async markAsProcessing(attempt, payload, transaction) {
        await attempt.update({
            status: AttemptStatus.PROCESSING,
            responsePayload: payload
        }, { transaction });
    }
}
