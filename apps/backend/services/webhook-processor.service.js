import axios from 'axios';
import { HttpClient } from '../utils/http-client.js';
import {
  WebhookEvent,
  PaymentIntent,
  PaymentAttempt,
  Order,
  sequelize,
  AdminNotification,
  NotificationSettings,
} from "../models/index.js";
import { PaymentStatus, AttemptStatus, OrderStatus } from "../enums/index.js";
import { ProviderFactory } from "../providers/index.js";
import { MailService } from "./mail.service.js";
import { LmsBridgeService } from "./lms-bridge.service.js";
import { B2BProvisioningService } from "./b2b-provisioning.service.js";

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
          providerId: null, // Initialisation
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
        console.log(`[WebhookProcessor] Stripe webhook object:`, {
          id: stripeObj?.id,
          client_reference_id: stripeObj?.client_reference_id,
          metadata: stripeObj?.metadata,
          object: stripeObj?.object
        });
        transactionNumber =
          stripeObj?.metadata?.transactionNumber ||
          stripeObj?.client_reference_id ||
          stripeObj?.id;

        console.log(`[WebhookProcessor] Extracted transaction number for Stripe: ${transactionNumber}`);
      } else if (providerCode === "kkiapay") {
        transactionNumber =
          payload.partnerId ||
          payload.transactionId ||
          payload.transaction_id ||
          payload.transaction_reference;

        console.log(
          `[WebhookProcessor] KKiaPay payload: isPaymentSucces=${payload.isPaymentSucces}, event=${payload.event}, transactionId=${payload.transactionId}, partnerId=${payload.partnerId}`,
        );
      }

      // 3. Find the attempt
      let attempt = null;

      if (transactionNumber) {
        console.log(
          `[WebhookProcessor] Processing transaction: ${transactionNumber}`,
        );

        attempt = await PaymentAttempt.findOne(
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
      }

      // KKiaPay fallback: try to find via amount matching if not found
      if (!attempt && providerCode === "kkiapay" && payload.amount) {
        console.log(
          `[WebhookProcessor] KKiaPay: Attempt not found by transactionNumber=${transactionNumber}, trying fallback via amount=${payload.amount}...`,
        );

        const recentAttempts = await PaymentAttempt.findAll(
          {
            where: {
              createdAt: {
                [Symbol.for("gte")]: new Date(Date.now() - 2 * 60 * 60 * 1000),
              },
            },
            include: [
              {
                model: PaymentIntent,
                as: "paymentIntent",
                include: [{ model: Order, as: "order" }],
              },
            ],
            order: [["createdAt", "DESC"]],
            limit: 20,
          },
          { transaction },
        );

        attempt = recentAttempts.find(
          (a) => a.paymentIntent?.amount === payload.amount,
        );
      }

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

        // Signature Validation for non-synced flow
        let signatureValid = true;
        if (providerCode === "kkiapay" && signature) {
          const kkiapay = ProviderFactory.getProvider("kkiapay");
          signatureValid = kkiapay.validateWebhookSignature(payload, signature);
          if (!signatureValid) {
            console.warn(`[WebhookProcessor] Invalid signature for KKiaPay`);
            event.signatureValid = false;
          }
        }

        if (signatureValid) {
          if (providerCode === "cinetpay") {
            console.log(
              `[WebhookProcessor] Verifying CinetPay Tx: ${transactionNumber}`,
            );
            const cinetpay = ProviderFactory.getProvider("cinetpay");
            const verification = await cinetpay.checkStatus(transactionNumber);

            if (verification.success) {
              finalStatus = verification.status;
              providerResponse = verification.response;
            } else {
              console.warn(
                `[WebhookProcessor] CinetPay verification FAILED: ${verification.errorMessage}`,
              );
            }
          } else {
            const isSuccess = this.isSuccessEvent(providerCode, payload);
            const isFailure = this.isFailureEvent(providerCode, payload);

            if (isSuccess) finalStatus = PaymentStatus.SUCCEEDED;
            else if (isFailure) finalStatus = PaymentStatus.FAILED;
          }
        }

        if (finalStatus === PaymentStatus.SUCCEEDED) {
          await this.markAsSucceeded(attempt, providerResponse, transaction, providerCode);
          // notificationData = { type: "success", intent, order };

          // Notify Auction System if applicable
          if (order.metadata?.source === "AUCTION" && order.metadata?.auction_id) {
            try {
              const auctionId = order.metadata.auction_id;
              // DEFAULT to 3001 if not in environment
              const auctionServerUrl = process.env.AUCTION_SERVER_URL || 'http://localhost:3001/api/auctions';
              
              console.log(`[WebhookProcessor] Notifying auction system for auction #${auctionId}`);
              
              await HttpClient.postWithRetry(`${auctionServerUrl}/${auctionId}/payment-confirm`, {
                auctionId: auctionId,
                orderReference: order.reference,
                amount: order.totalAmount,
                payment_id: attempt.transactionNumber, // Payment ID from gateway
                status: 'paid'
              }, {
                headers: { 'x-internal-key': process.env.INTERNAL_API_KEY }
              });
            } catch (err) {
              console.error(`[WebhookProcessor] Failed to notify auction system: ${err.message}`);
              // Error logged but process continues (handled by HttpClient retries and alerts)
            }
          }

          // LMS Specialization: NO AUTO-ENROLLMENT anymore (Phase 4 manual)
          // await LmsBridgeService.syncEnrollment(order);

          // ── Admin Alerts Redesign ──
          await this.notifyAdminsForValidation(order);

          // Phase 2: Send payment confirmation WITHOUT invoice
          // Phase 2: Send payment confirmation WITHOUT invoice
          await MailService.sendPaymentConfirmed(order);

          // B2B Phase: Auto-Provisioning
          if (order.metadata?.is_b2b) {
            try {
              await B2BProvisioningService.handleB2BOrder(order);
            } catch (err) {
              console.error(`[WebhookProcessor] B2B Provisioning failed for Order ${order.reference}:`, err);
              // We don't fail the whole webhook because payment IS successful.
              // Admin will see the payment and have to manual provision or retry.
            }
          }
        } else if (finalStatus === PaymentStatus.FAILED) {
          await this.markAsFailed(attempt, providerResponse, transaction);
          notificationData = {
            type: "failure",
            intent,
            order,
            reason: providerResponse.message || "Payment failed",
          };

          await MailService.notifyLmsAdmins("failure", order, intent);

          await MailService.sendPaymentFailureNotification(
            intent,
            order,
            notificationData.reason
          );
        }

        event.processed = true;
        event.processedAt = new Date();
      } else {
        console.warn(
          `[WebhookProcessor] No payment attempt found for ID: ${transactionNumber}`,
        );
      }

      await event.save({ transaction });
      await transaction.commit();

      // Trigger notifications AFTER commit
      // (Handled directly above now for better control)

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

  static async markAsSucceeded(attempt, payload, transaction, providerCode) {
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

    // PHASE 2: Update Order status to 'payment_confirmed' (NOT 'completed')
    await Order.update(
      {
        status: OrderStatus.PAYMENT_CONFIRMED,
        paidAt: new Date(), // Set paidAt timestamp
        paymentProvider: providerCode,
        transactionReference: attempt.transactionNumber,
        paymentIntentId: String(attempt.paymentIntentId)
      },
      {
        where: { id: attempt.paymentIntent?.orderId || attempt.paymentIntentId },
        transaction,
      }
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

    await PaymentIntent.update(
      {
        status: PaymentStatus.FAILED,
      },
      {
        where: { id: attempt.paymentIntentId },
        transaction,
      },
    );

    await Order.update(
      {
        status: OrderStatus.FAILED,
      },
      {
        where: { id: attempt.paymentIntent?.orderId || attempt.paymentIntentId },
        transaction,
      }
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

  /**
   * Notify administrators that a new order is waiting for validation
   */
  static async notifyAdminsForValidation(order) {
    try {
      // 1. In-App Notification (for Dashboard Bell)
      await AdminNotification.create({
        type: "WARNING",
        title: "Nouveau paiement à valider",
        message: `La commande ${order.reference} de ${order.customerEmail} est confirmée et attend votre validation.`,
        orderReference: order.reference,
        metadata: { orderId: order.id }
      });

      // 2. Email Notifications (based on Admin Preferences)
      const admins = await NotificationSettings.findAll({
        where: { notifyOnNewOrder: true, isActive: true }
      });

      for (const admin of admins) {
        await MailService.sendAdminOrderValidationAlert(admin.adminEmail, order);
      }
    } catch (error) {
      console.error("[WebhookProcessor] Error notifying admins:", error);
    }
  }
}
