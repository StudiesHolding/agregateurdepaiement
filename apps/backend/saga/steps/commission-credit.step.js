/**
 * Étape de saga — Crédit de commission (ticket S1-5)
 *
 * Exécutée par MoodleHeadlessStrategy APRES une inscription réussie
 * (COMPLETED ou COMPLETED_IDEMPOTENT) d'une commande B2C.
 *
 * Règles métier :
 * - Appelle POST {SL_BACKEND_URL}/api/internal/payments/confirmed
 *   (en-tête X-Internal-Api-Key), idempotent par orderRef + formationId.
 * - Commande QA/mock (référence QA-… ou metadata.qa / is_qa / is_test) → rien.
 * - Réessais avec attente exponentielle sur réseau / 5xx / 429 uniquement.
 * - 400 / 401 = échec définitif : journalisé en erreur + alerte admin
 *   (AdminNotificationService) — l'inscription et la commande restent acquises.
 * - Un échec de crédit n'annule JAMAIS l'inscription déjà faite : l'étape est
 *   compensable par simple rejeu (idempotence côté backend).
 * - Traces dans le journal d'audit de commande (order-audit-log) :
 *   COMMISSION_CREDIT_REQUESTED (demandé), COMMISSION_CREDIT_CREDITED
 *   (crédité : montant, taux, bénéficiaire), COMMISSION_CREDIT_REPLAY
 *   (rejeu idempotent), COMMISSION_CREDIT_FAILED (échec).
 */
import { Order } from '../../models/index.js';
import {
  SlBackendCommissionClient,
  isRetryableCommissionStatus,
  isCommissionCreditEnabled,
} from '../../services/sl-backend-commission.client.js';

const ALLOWED_CHANNELS = ['direct', 'trainer_link', 'institution_link'];

/**
 * Actions d'audit dédiées au crédit de commission (order-audit-log)
 */
export const CommissionAuditAction = {
  REQUESTED: 'COMMISSION_CREDIT_REQUESTED',
  CREDITED: 'COMMISSION_CREDIT_CREDITED',
  REPLAY: 'COMMISSION_CREDIT_REPLAY',
  FAILED: 'COMMISSION_CREDIT_FAILED',
};

export const CommissionAuditActionLabels = {
  [CommissionAuditAction.REQUESTED]: 'Crédit de commission demandé',
  [CommissionAuditAction.CREDITED]: 'Commission créditée',
  [CommissionAuditAction.REPLAY]: 'Crédit de commission — rejeu idempotent',
  [CommissionAuditAction.FAILED]: 'Échec du crédit de commission',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * grossAmount = total_amount en chaîne décimale exacte.
 * Sequelize (DECIMAL 15,2) renvoie déjà une chaîne ; sinon on normalise
 * en chaîne décimale à 2 chiffres.
 */
export function toExactDecimalString(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2);
  return String(value ?? '0');
}

/** paidAt = date de confirmation du paiement, au format ISO 8601 */
export function toIsoPaidAt(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export class CommissionCreditStep {
  /**
   * @param {Object} [options]
   * @param {Object} [options.client] - Client HTTP (injectable pour les tests)
   * @param {number} [options.maxAttempts] - Nb d'essais internes (défaut 3,
   *   COMMISSION_CREDIT_MAX_ATTEMPTS)
   * @param {number} [options.retryBaseDelayMs] - Base du backoff exponentiel
   *   (défaut 1000 ms, COMMISSION_CREDIT_RETRY_DELAY_MS)
   */
  constructor(options = {}) {
    this.client = options.client || new SlBackendCommissionClient();
    this.maxAttempts =
      options.maxAttempts ?? parseInt(process.env.COMMISSION_CREDIT_MAX_ATTEMPTS || '3', 10);
    this.retryBaseDelayMs =
      options.retryBaseDelayMs ??
      parseInt(process.env.COMMISSION_CREDIT_RETRY_DELAY_MS || '1000', 10);
  }

  /**
   * Exécute l'étape « crédit de commission ».
   *
   * @param {Object} params
   * @param {string} params.orderReference - Référence de la commande
   * @param {number} params.studentId - Identifiant apprenant de l'inscription (kyd4_users)
   * @param {string} params.correlationId - ID de corrélation de la saga
   * @returns {Promise<Object>} { credited, skipped?, reason?, beneficiary?, amount?, rate? }
   * @throws {CommissionRetryableError} Après épuisement des essais internes sur
   *   réseau / 5xx / 429 — l'inscription déjà faite n'est jamais annulée,
   *   l'étape est compensable par rejeu (idempotence côté backend).
   */
  async execute({ orderReference, studentId, correlationId, channel = null }) {
    const log = (msg, ...args) =>
      console.log(`[CommissionCreditStep:${correlationId}] ${msg}`, ...args);

    // 1. Feature flag (COMMISSION_CREDIT_ENABLED, défaut true)
    if (!isCommissionCreditEnabled()) {
      log('Disabled (COMMISSION_CREDIT_ENABLED=false) — skipping');
      return { skipped: true, reason: 'disabled' };
    }

    // 2. Configuration requise (le démarrage hors test est refusé si absente)
    if (!this.client.isConfigured()) {
      console.warn(
        `[CommissionCreditStep:${correlationId}] SL_BACKEND_URL / INTERNAL_API_KEY absents — skipping`,
      );
      return { skipped: true, reason: 'not_configured' };
    }

    // 3. Charger la commande (montant exact, canal, date de paiement)
    const order = await Order.findOne({ where: { reference: orderReference } });
    if (!order) {
      console.error(
        `[CommissionCreditStep:${correlationId}] Order ${orderReference} not found — skipping commission credit`,
      );
      return { skipped: true, reason: 'order_not_found' };
    }

    const metadata = this.parseMetadata(order.metadata);

    // 4. Commande QA/mock → aucun appel, aucune trace
    if (this.isQaOrder(orderReference, metadata)) {
      log('QA/mock order — no commission credit');
      return { skipped: true, reason: 'qa_order' };
    }

    // 5. Corps exact attendu par le backend métier
    const payload = {
      orderRef: order.reference,
      formationId: Number(order.formationId),
      studentId: Number(studentId),
      grossAmount: toExactDecimalString(order.totalAmount),
      currency: order.currency,
      // Canal vérifié par le backend à l'inscription (ADR-0012, D14), sinon celui des métadonnées de commande.
      channel: ALLOWED_CHANNELS.includes(channel) ? channel : this.resolveChannel(metadata),
      paidAt: toIsoPaidAt(order.paidAt),
      correlationId,
      // Coupon (ADR-0012, D13) : prix avant coupon et financeur de la remise — la part de l'auteur s'en déduit.
      ...(/^\d+(\.\d{1,3})?$/.test(String(metadata.coupon_list_amount ?? '')) && ['author', 'platform'].includes(metadata.coupon_funder)
        ? { listAmount: String(metadata.coupon_list_amount), couponFunder: metadata.coupon_funder }
        : {}),
    };

    log(
      `Requesting commission credit for order ${orderReference}` +
        ` (amount=${payload.grossAmount} ${payload.currency}, channel=${payload.channel})`,
    );

    // Trace d'audit : demandé
    await this.audit(order, CommissionAuditAction.REQUESTED, { payload });

    // 6. Appel + réessais (réseau / 5xx / 429 uniquement), backoff exponentiel
    let lastResult = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      lastResult = await this.client.creditCommission(payload, correlationId);

      if (lastResult.status === 200) {
        return this.handleSuccess(order, lastResult, correlationId);
      }

      if (!isRetryableCommissionStatus(lastResult.status)) {
        return this.handleDefinitiveFailure(order, payload, lastResult, correlationId);
      }

      if (attempt < this.maxAttempts) {
        const delay = this.retryBaseDelayMs * 2 ** (attempt - 1);
        console.warn(
          `[CommissionCreditStep:${correlationId}] Attempt ${attempt}/${this.maxAttempts}` +
            ` got HTTP ${lastResult.status} — retrying in ${delay}ms`,
        );
        await sleep(delay);
      }
    }

    // 7. Épuisement des essais → échec réessayable (jamais d'annulation de
    //    l'inscription : la saga rejoue, le backend de commission est idempotent)
    const message =
      lastResult?.data?.message ||
      `SL backend unavailable after ${this.maxAttempts} attempts (HTTP ${lastResult?.status})`;
    console.error(
      `[CommissionCreditStep:${correlationId}] ❌ Commission credit retryable failure` +
        ` for ${orderReference}: ${message}`,
    );
    await this.audit(order, CommissionAuditAction.FAILED, {
      httpStatus: lastResult?.status,
      error: message,
      retryable: true,
    });
    throw new CommissionRetryableError(
      `Commission credit failed for order ${orderReference}: ${message}`,
    );
  }

  /** 200 : crédité (ou rejeu idempotent si idempotentReplay) */
  async handleSuccess(order, result, correlationId) {
    const data = result.data || {};
    const trace = {
      credited: data.credited !== false,
      beneficiary: data.beneficiary ?? null,
      walletId: data.walletId ?? null,
      amount: data.amount ?? null,
      rate: data.rate ?? null,
      idempotentReplay: Boolean(data.idempotentReplay),
    };

    if (trace.credited === false) {
      // 200 avec credited=false : réponse métier définitive (ex. aucun bénéficiaire)
      console.error(
        `[CommissionCreditStep:${correlationId}] Commission not credited for ${order.reference}:`,
        JSON.stringify(data),
      );
      await this.audit(order, CommissionAuditAction.FAILED, {
        httpStatus: 200,
        error: data.reason || data.message || 'credited=false',
        retryable: false,
      });
      return { credited: false, definitiveFailure: true, details: data };
    }

    if (trace.idempotentReplay) {
      await this.audit(order, CommissionAuditAction.REPLAY, trace);
    } else {
      await this.audit(order, CommissionAuditAction.CREDITED, trace);
    }

    console.log(
      `[CommissionCreditStep:${correlationId}] ✅ Commission credited for ${order.reference}` +
        ` (beneficiary=${trace.beneficiary}, amount=${trace.amount},` +
        ` rate=${trace.rate}, replay=${trace.idempotentReplay})`,
    );
    return { ...trace, definitiveFailure: false };
  }

  /** 400 / 401 / autre 4xx : échec définitif — alerte admin, sans impact sur l'inscription */
  async handleDefinitiveFailure(order, payload, result, correlationId) {
    const status = result.status;
    const error =
      result.data?.message || result.data?.error || `HTTP ${status} from SL backend`;

    console.error(
      `[CommissionCreditStep:${correlationId}] ❌ Commission credit definitive failure` +
        ` for ${order.reference} (HTTP ${status}): ${error}`,
    );

    await this.audit(order, CommissionAuditAction.FAILED, {
      httpStatus: status,
      error,
      retryable: false,
    });

    // Alerte admin (mécanisme de notification existant)
    await this.notifyAdmin(order, payload, status, error, correlationId);

    return { credited: false, definitiveFailure: true, httpStatus: status, error };
  }

  /** channel = metadata.channel si autorisé, sinon 'direct' */
  resolveChannel(metadata) {
    return ALLOWED_CHANNELS.includes(metadata?.channel) ? metadata.channel : 'direct';
  }

  /** Commande QA/mock : référence QA-… ou indicateur de test existant */
  isQaOrder(orderReference, metadata) {
    return (
      /^QA-/i.test(String(orderReference || '')) ||
      metadata?.qa === true ||
      metadata?.is_qa === true ||
      metadata?.is_test === true
    );
  }

  parseMetadata(raw) {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw;
  }

  /** Trace dans le journal d'audit de commande (order-audit-log) */
  async audit(order, action, newState) {
    try {
      const { OrderAuditService } = await import('../../services/order-audit.service.js');
      await OrderAuditService.logSystemAction({
        orderId: order.id,
        orderReference: order.reference,
        action,
        actionLabel: CommissionAuditActionLabels[action],
        newState,
      });
    } catch (err) {
      // Ne jamais faire échouer l'étape si l'audit échoue
      console.error(
        `[CommissionCreditStep] Failed to log audit action ${action} for ${order.reference}:`,
        err.message,
      );
    }
  }

  /** Alerte admin via le mécanisme de notification existant */
  async notifyAdmin(order, payload, status, error, correlationId) {
    try {
      const { AdminNotificationService } = await import(
        '../../services/admin-notification.service.js'
      );
      await AdminNotificationService.notifyCommissionCreditFailure(order.reference, {
        status,
        error,
        channel: payload.channel,
        grossAmount: payload.grossAmount,
        currency: payload.currency,
        formationId: payload.formationId,
        studentId: payload.studentId,
        correlationId,
      });
    } catch (err) {
      console.error(
        `[CommissionCreditStep:${correlationId}] Failed to notify admins for ${order.reference}:`,
        err.message,
      );
    }
  }
}

/**
 * Échec réessayable du crédit de commission — même sémantique que
 * MoodleRetryableError : le worker BullMQ rejoue le job (l'inscription déjà
 * faite est conservée, le backend de commission est idempotent).
 */
export class CommissionRetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CommissionRetryableError';
  }
}

export default CommissionCreditStep;

