import axios from 'axios';
import { HttpClient } from '../utils/http-client.js';
import {
  WebhookEvent,
  PaymentIntent,
  PaymentAttempt,
  Order,
  sequelize,
  AdminNotification,
} from "../models/index.js";
import { PaymentStatus, AttemptStatus, OrderStatus } from "../enums/index.js";
import { ProviderFactory } from "../providers/index.js";
import { MailService } from "./mail.service.js";
import { LmsBridgeService } from "./lms-bridge.service.js";
import { B2BProvisioningService } from "./b2b-provisioning.service.js";
import { bindConfirmation, checkKkiapaySignature, verificationId } from "./payments/confirmation.js";
import { emit } from "./notifications/notification-engine.js";
import { purchaseWords } from "../utils/purchase-labels.js";
import { classify } from "./finance/failure-taxonomy.js";

export class WebhookProcessor {
  static parseOrderMetadata(raw) {
    if (!raw) return {};
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw;
  }

  /**
   * Record and process a webhook event
   */
  static async processEvent(providerCode, payload, signature = null) {
    let transaction = null;
    let notificationData = null;
    // Notifications de l'équipe (ADR-0019, D7) : émises APRÈS la validation de la transaction, jamais dedans.
    const afterCommit = [];

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

      if (attempt && attempt.paymentIntent && attempt.paymentIntent.order) {
        console.log(
          `[WebhookProcessor] Found attempt for Order: ${attempt.paymentIntent.order.reference}`,
        );
        event.providerId = attempt.providerId;
        const intent = attempt.paymentIntent;
        const order = intent.order;

        // Vérification serveur (ADR-0019, D5) : le contenu du webhook ne prouve rien ; seule la réponse du
        // prestataire interrogé par nous, liée à CETTE tentative (référence, montant, devise), fait foi.
        let finalStatus = null;
        let providerResponse = payload;

        if (attempt.status === AttemptStatus.SUCCEEDED) {
          // Idempotence : un paiement déjà confirmé ne relance ni inscription ni courriel.
          event.errorMessage = "Paiement déjà confirmé : notification ignorée.";
          event.processed = true;
          event.processedAt = new Date();
          await event.save({ transaction });
          await transaction.commit();
          return { success: true, eventId: event.id, duplicate: true };
        }

        const sig = providerCode === "kkiapay"
          ? checkKkiapaySignature(signature, process.env.KKIAPAY_WEBHOOK_SECRET, payload)
          : { checked: false, valid: true };
        if (!sig.valid) {
          event.signatureValid = false;
          event.errorMessage = "Signature du webhook invalide : notification rejetée.";
          console.warn(`[WebhookProcessor] Signature invalide (${providerCode}) pour ${transactionNumber}`);
          afterCommit.push(() => emit("webhook.bad_signature", {
            title: `Notification ${providerCode} à signature invalide`,
            lines: [`${purchaseWords(order).Noun} ${order.reference} : la notification a été rejetée, le paiement n’est pas validé.`, "Vérifiez le secret des webhooks du prestataire ; si la configuration est bonne, traitez-le comme un incident de sécurité."],
            severity: "danger", href: "/webhooks", key: `badsig:${transactionNumber}`, orderReference: order.reference,
          }));
        } else if (process.env.NODE_ENV === "test" && providerCode === "cinetpay" && payload.cpm_result === "00") {
          // ATDD : payload QA simulé (cpm_result=00) — pas d'appel API CinetPay
          finalStatus = PaymentStatus.SUCCEEDED;
        } else {
          const verifyWith = verificationId(providerCode, payload, attempt);
          const verification = verifyWith
            ? await ProviderFactory.getProvider(providerCode).checkStatus(verifyWith)
            : { success: false, error: "identifiant de vérification absent" };
          if (!verification.success) {
            // Laissé non traité : rejouable depuis l'administration quand le prestataire répond.
            event.errorMessage = `Vérification impossible auprès de ${providerCode} : ${verification.error || verification.errorMessage || "réponse invalide"}`;
            console.warn(`[WebhookProcessor] ${event.errorMessage}`);
          } else if (verification.status === PaymentStatus.SUCCEEDED) {
            const binding = bindConfirmation(providerCode, verification.response, {
              transactionNumber: attempt.transactionNumber, amount: Number(intent.amount), currency: intent.currency,
            });
            if (binding.ok) {
              finalStatus = PaymentStatus.SUCCEEDED;
              providerResponse = verification.response;
            } else {
              event.errorMessage = `Confirmation refusée : ${binding.reason}.`;
              console.warn(`[WebhookProcessor] ${event.errorMessage} (${order.reference})`);
              afterCommit.push(() => emit("confirmation.suspicious", {
                title: "Confirmation de paiement suspecte",
                lines: [`${order.reference} : ${binding.reason}.`, "Le paiement n’a pas été validé. Examinez la transaction chez le prestataire avant toute action."],
                severity: "danger", href: `/transactions?search=${encodeURIComponent(order.reference)}`, key: `suspicious:${attempt.transactionNumber}`, orderReference: order.reference,
                payload: { providerCode, transactionNumber: attempt.transactionNumber },
              }));
            }
          } else if (verification.status === PaymentStatus.FAILED || verification.status === PaymentStatus.CANCELED) {
            finalStatus = PaymentStatus.FAILED;
            providerResponse = verification.response ?? payload;
          }
          // En attente chez le prestataire : rien à décider, une prochaine notification tranchera.
        }

        if (finalStatus === PaymentStatus.SUCCEEDED) {
          await this.markAsSucceeded(attempt, providerResponse, transaction, providerCode);

          // ─────────────────────────────────────────────────────────────
          // FEATURE FLAG — Strangler Fig Pattern (Phase 2)
          // 
          // Seuls les B2B_PACKAGE et MOODLE_HEADLESS passent par la Saga.
          // RETAIL et AUCTION legacy utilisent encore l'ancien flux synchrone.
          // 
          // Lorsque la Saga sera stabilisée, on supprimera la branche else
          // et TOUT le trafic passera par la Saga.
          // ─────────────────────────────────────────────────────────────
          const metadata = this.parseOrderMetadata(order.metadata);
          const isNewSagaEnabled = (
            metadata.is_b2b === true ||
            metadata.b2b_purchase === true ||
            metadata.source === 'AUCTION' ||
            metadata.source === 'MOODLE_HEADLESS' ||
            // Formation canonique (ADR-0012, P5) : l'ancien flux synchrone n'inscrivait personne.
            metadata.purchase_type === 'B2C_COURSE' ||
            // Frais d'étude de dossier d'une candidature (ADR-0016, D6 bis).
            metadata.purchase_type === 'ADMISSION_FEE'
          );

          if (isNewSagaEnabled) {
            // 🚀 NOUVEAU FLUX ASYNCHRONE (BullMQ)
            console.log(`[WebhookProcessor] 🚀 Routing ${order.reference} to Saga (feature flag ON)`);
            
            const { dispatchOrderToSaga } = await import('../saga/payment-event-dispatcher.service.js');
            dispatchOrderToSaga(order, `webhook-${Date.now()}`).catch(err => {
              console.error(`[WebhookProcessor] Failed to dispatch order ${order.reference} to saga:`, err.message);
            });
          } else {
            // 🐢 ANCIEN FLUX SYNCHRONE (conservé intact pour la transition)
            console.log(`[WebhookProcessor] 🐢 Using legacy sync flow for ${order.reference}`);

            // Notify Auction System if applicable (legacy sync path)
            if (metadata.source === "AUCTION" && metadata.auction_id) {
              try {
                const { HttpClient } = await import('../utils/http-client.js');
                const auctionId = metadata.auction_id;
                const auctionServerUrl = process.env.AUCTION_SERVER_URL || 'http://localhost:3001/api/auctions';
                await HttpClient.postWithRetry(`${auctionServerUrl}/${auctionId}/payment-confirm`, {
                  auctionId, orderReference: order.reference, amount: order.totalAmount,
                  payment_id: attempt.transactionNumber, status: 'paid'
                }, { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY } });
              } catch (err) {
                console.error(`[WebhookProcessor] Failed to notify auction system: ${err.message}`);
              }
            }

            // B2B Legacy sync provisioning (conservé intact)
            if (metadata.is_b2b) {
              try {
                const { B2BProvisioningService } = await import('./b2b-provisioning.service.js');
                await B2BProvisioningService.handleB2BOrder(order);
              } catch (err) {
                console.error(`[WebhookProcessor] B2B Provisioning failed for Order ${order.reference}:`, err);
              }
            }

            // Legacy LMS enrollment (commenté mais conservé pour référence)
            // const { LmsBridgeService } = await import('./lms-bridge.service.js');
            // await LmsBridgeService.syncEnrollment(order);
          }

          // ── Alertes de l'équipe, selon les règles de notification ──
          const amountLabel = `${Number(intent.amount).toLocaleString("fr-FR")} ${intent.currency}`;
          afterCommit.push(() => emit("payment.succeeded", {
            title: `Paiement confirmé : ${amountLabel}`,
            lines: [`${purchaseWords(order).Noun} ${order.reference}${order.formationName ? ` · ${order.formationName}` : ""}, via ${providerCode}.`],
            severity: "info", href: `/transactions?search=${encodeURIComponent(order.reference)}`, key: `paid:${order.reference}`, orderReference: order.reference,
          }, { amount: Number(intent.amount), currency: intent.currency }));
          if (!isNewSagaEnabled) {
            // Ancien flux : l'achat attend une validation manuelle.
            afterCommit.push(() => emit("order.to_validate", {
              title: `${purchaseWords(order).Noun} à valider : ${order.reference}`,
              lines: [`Payée (${amountLabel}) par ${order.customerEmail}, elle attend la validation de l’équipe.`],
              severity: "warning", href: `/orders/${order.id}`, key: `validate:${order.reference}`, orderReference: order.reference,
            }));
          }

          // Phase 2: Send payment confirmation WITHOUT invoice
          await MailService.sendPaymentConfirmed(order);
        } else if (finalStatus === PaymentStatus.FAILED) {
          await this.markAsFailed(attempt, providerResponse, transaction);
          notificationData = {
            type: "failure",
            intent,
            order,
            reason: providerResponse.message || "Payment failed",
          };

          const cause = classify({ errorCode: providerResponse?.code ?? providerResponse?.errorCode, errorMessage: providerResponse?.message, response: providerResponse });
          afterCommit.push(() => emit("payment.failed", {
            title: `Paiement échoué : ${order.reference}`,
            lines: [`${cause.label} — ${cause.explanation}`, cause.action],
            severity: "warning", href: "/failures", key: `failed:${attempt.transactionNumber}`, orderReference: order.reference,
          }));

          await MailService.sendPaymentFailureNotification(
            intent,
            order,
            notificationData.reason
          );
        }

        if (finalStatus) {
          event.processed = true;
          event.processedAt = new Date();
        }
      } else {
        // Aucune devinette (l'ancien rapprochement « par montant » permettait de confirmer la mauvaise inscription).
        event.errorMessage = `Aucune tentative pour la référence ${transactionNumber ?? "(absente)"}.`;
        console.warn(`[WebhookProcessor] ${event.errorMessage}`);
      }

      await event.save({ transaction });
      await transaction.commit();
      for (const notify of afterCommit) await notify();

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
        where: { id: attempt.paymentIntent.orderId },
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

    const orderId = attempt.paymentIntent?.orderId || attempt.paymentIntentId;
    await Order.update(
      {
        status: OrderStatus.FAILED,
      },
      {
        where: { id: orderId },
        transaction,
      }
    );

    // Coupon réservé pour cette inscription : libéré dès l'échec (sinon il expire seul au bout de 45 min).
    // Appel HTTP après la validation de la transaction, sans jamais bloquer le traitement du webhook.
    const releaseCoupon = async () => {
      try {
        const order = await Order.findByPk(orderId);
        const raw = order?.metadata;
        const metadata = typeof raw === "string" ? JSON.parse(raw) : raw ?? {};
        if (!metadata?.coupon_reservation_id) return;
        const { SlBackendCouponClient } = await import("./sl-backend-coupon.client.js");
        const { status } = await new SlBackendCouponClient().release(metadata.coupon_reservation_id);
        if (status !== 200) console.error(`[Webhook] coupon de l’inscription ${order.reference} non libéré (HTTP ${status}) : il expirera seul`);
      } catch (error) {
        console.error("[Webhook] libération du coupon impossible (non bloquant) :", error?.message ?? error);
      }
    };
    if (transaction && typeof transaction.afterCommit === "function") transaction.afterCommit(() => { void releaseCoupon(); });
    else void releaseCoupon();
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

}
