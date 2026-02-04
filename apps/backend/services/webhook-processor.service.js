import {
  WebhookEvent,
  PaymentIntent,
  PaymentAttempt,
  Order,
  sequelize,
} from "../models/index.js";
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
      const event = await WebhookEvent.create(
        {
          eventType: payload.event_type || payload.code || "unknown",
          payload: payload,
          signatureValid: true,
          processed: false,
        },
        { transaction },
      );

      // 2. Identify transaction
      let transactionNumber = null;
      if (providerCode === "cinetpay") {
        transactionNumber =
          payload.cpm_trans_id || payload.client_transaction_id;
      } else if (providerCode === "stripe") {
        const stripeObj = payload.data?.object;
        transactionNumber =
          stripeObj?.metadata?.transactionNumber ||
          stripeObj?.client_reference_id ||
          stripeObj?.id;
      } else if (providerCode === "kkiapay") {
        // KKiaPay webhook payload structure
        // Format: { transactionId, isPaymentSucces, event, ... }
        transactionNumber =
          payload.reference ||
          payload.transactionId ||
          payload.transaction_id ||
          payload.metadata?.transactionNumber;

        // Debug log for KKiaPay
        console.log(
          `[WebhookProcessor] KKiaPay payload: isPaymentSucces=${payload.isPaymentSucces}, event=${payload.event}, transactionId=${payload.transactionId}`,
        );

        // Also check event field directly
        if (payload.event === "transaction.success") {
          console.log(
            `[WebhookProcessor] KKiaPay SUCCESS detected from event field`,
          );
        } else if (payload.event === "transaction.failed") {
          console.log(
            `[WebhookProcessor] KKiaPay FAILURE detected from event field`,
          );
        }
      }

      if (transactionNumber) {
        console.log(
          `[WebhookProcessor] Processing transaction: ${transactionNumber}`,
        );

        // Find the attempt with Intent and Order
        const attempt = await PaymentAttempt.findOne(
          {
            where: { transactionNumber },
            include: [
              {
                model: PaymentIntent,
                as: "paymentIntent",
                include: [{ model: Order, as: "order" }],
              },
            ],
          },
          { transaction },
        );

        if (attempt && attempt.paymentIntent && attempt.paymentIntent.order) {
          console.log(
            `[WebhookProcessor] Found attempt for Order: ${attempt.paymentIntent.order.reference}`,
          );
          event.providerId = attempt.providerId;
          const intent = attempt.paymentIntent;
          const order = intent.order;

          // Professional Verification Flow
          let finalStatus = null;
          let providerResponse = payload;

          if (providerCode === "cinetpay") {
            // Anti-MitM: Call CinetPay API to verify the real status
            console.log(
              `[WebhookProcessor] Verifying CinetPay Tx: ${transactionNumber}`,
            );
            const cinetpay = ProviderFactory.getProvider("cinetpay");
            const verification = await cinetpay.checkStatus(transactionNumber);

            if (verification.success) {
              console.log(
                `[WebhookProcessor] CinetPay verification: ${verification.status}`,
              );
              finalStatus = verification.status;
              providerResponse = verification.response;
            } else {
              console.warn(
                `[WebhookProcessor] CinetPay verification FAILED for ${transactionNumber}: ${verification.errorMessage || "Unknown error"}`,
              );
            }
          } else {
            // For other providers (Stripe, KKiaPay), we map from the validated payload
            let signatureValid = true;

            // Validate KKiaPay signature if provided
            if (providerCode === "kkiapay" && signature) {
              const kkiapay = ProviderFactory.getProvider("kkiapay");
              signatureValid = kkiapay.validateWebhookSignature(
                payload,
                signature,
              );
              console.log(
                `[WebhookProcessor] KKiaPay signature validation: ${signatureValid}`,
              );
            }

            if (!signatureValid) {
              console.warn(
                `[WebhookProcessor] Invalid signature for ${providerCode} webhook`,
              );
              event.signatureValid = false;
            }

            const eventType = payload.type;
            const isSuccess = this.isSuccessEvent(providerCode, payload);
            const isFailure = this.isFailureEvent(providerCode, payload);
            console.log(
              `[WebhookProcessor] ${providerCode} event: ${eventType}, isSuccess: ${isSuccess}, isFailure: ${isFailure}`,
            );
            if (isSuccess) finalStatus = PaymentStatus.SUCCEEDED;
            else if (isFailure) finalStatus = PaymentStatus.FAILED;
          }

          if (finalStatus === PaymentStatus.SUCCEEDED) {
            await this.markAsSucceeded(attempt, providerResponse, transaction);
            notificationData = { type: "success", intent, order };
          } else if (finalStatus === PaymentStatus.FAILED) {
            await this.markAsFailed(attempt, providerResponse, transaction);
            notificationData = {
              type: "failure",
              intent,
              order,
              reason: providerResponse.message || "Payment failed",
            };
          } else if (finalStatus === PaymentStatus.PROCESSING) {
            await this.markAsProcessing(attempt, providerResponse, transaction);
            console.log(
              `[WebhookProcessor] Payment is still processing/waiting for: ${transactionNumber}`,
            );
          }

          event.processed = true;
          event.processedAt = new Date();
        } else {
          console.warn(
            `[WebhookProcessor] No payment attempt found for ID: ${transactionNumber}`,
          );
          console.log(
            " Tip: Webhooks use the Transaction Number (TXN-...), not the Order Reference (ORD-...).",
          );
        }
      }

      await event.save({ transaction });
      await transaction.commit();

      // Trigger notifications AFTER commit to ensure data integrity
      if (notificationData) {
        if (notificationData.type === "success") {
          await MailService.sendPaymentSuccessNotification(
            notificationData.intent,
            notificationData.order,
          );
          await MailService.sendAdminNotification(
            `Nouveau paiement reçu - ${notificationData.order.reference}`,
            `Un paiement de ${notificationData.intent.amount} ${notificationData.intent.currency} a été confirmé pour ${notificationData.order.customerName}.`,
          );
        } else {
          await MailService.sendPaymentFailureNotification(
            notificationData.intent,
            notificationData.order,
            notificationData.reason,
          );
        }
      }

      return { success: true, eventId: event.id };
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error(
        `[WebhookProcessor] Error processing ${providerCode} event:`,
        error,
      );
      throw error;
    }
  }

  static isSuccessEvent(provider, payload) {
    if (provider === "cinetpay") return payload.cpm_result === "00";
    if (provider === "stripe")
      return payload.type === "checkout.session.completed";
    if (provider === "kkiapay") {
      // KKiaPay success: isPaymentSucces = true OR event = "transaction.success"
      return (
        payload.isPaymentSucces === true ||
        payload.event === "transaction.success" ||
        payload.event?.includes("success")
      );
    }
    return false;
  }

  static isFailureEvent(provider, payload) {
    if (provider === "cinetpay")
      return payload.cpm_result !== "00" && payload.cpm_result !== "waiting";
    if (provider === "stripe")
      return (
        payload.type === "checkout.session.expired" ||
        payload.type === "checkout.session.async_payment_failed"
      );
    if (provider === "kkiapay") {
      // KKiaPay failure: isPaymentSucces = false OR event = "transaction.failed"
      return (
        payload.isPaymentSucces === false ||
        payload.event === "transaction.failed" ||
        payload.event?.includes("failed")
      );
    }
    return false;
  }

  static async markAsSucceeded(attempt, payload, transaction) {
    await attempt.update(
      {
        status: AttemptStatus.SUCCEEDED,
        responsePayload: payload,
      },
      { transaction },
    );

    await PaymentIntent.update(
      {
        status: PaymentStatus.SUCCEEDED,
      },
      {
        where: { id: attempt.paymentIntentId },
        transaction,
      },
    );
  }

  static async markAsFailed(attempt, payload, transaction) {
    await attempt.update(
      {
        status: AttemptStatus.FAILED,
        responsePayload: payload,
        errorMessage: payload.message || "Payment failed via webhook",
      },
      { transaction },
    );
  }

  static async markAsProcessing(attempt, payload, transaction) {
    await attempt.update(
      {
        status: AttemptStatus.PROCESSING,
        responsePayload: payload,
      },
      { transaction },
    );
  }
}
