/**
 * Saga — achat B2C d'une formation canonique (ADR-0012, P5 / D8).
 *
 * Après un paiement confirmé (webhook signé) :
 *   1. inscription canonique sur le backend métier (`sl_enrollment`, idempotente par commande) — le backend
 *      résout le compte par l'e-mail du bénéficiaire et VÉRIFIE le lien d'auteur (canal 55 % ou 75 %) ;
 *   2. crédit de la commission de l'auteur sur ce canal vérifié (étape existante, idempotente) ;
 *   3. commande marquée COMPLETED.
 * Un échec réseau ou serveur est rejoué (BullMQ) sans risque de doublon ; un échec définitif (compte inconnu,
 * formation introuvable) passe la commande à vérifier et prévient les administrateurs.
 * L'inscription au cours Moodle part ensuite de l'outbox du backend (`ENROLLMENT_CREATED`).
 */
import { Order } from '../../models/index.js';
import { OrderStatus } from '../../enums/index.js';
import { SlBackendEnrollmentClient, isRetryableEnrollmentStatus } from '../../services/sl-backend-enrollment.client.js';
import { CommissionCreditStep } from '../steps/commission-credit.step.js';

export class EnrollmentRetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EnrollmentRetryableError';
  }
}

export class EnrollmentPermanentError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'EnrollmentPermanentError';
    this.code = code;
  }
}

const parseMetadata = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
};

export class B2cCourseSagaStrategy {
  constructor({ client = new SlBackendEnrollmentClient(), commissionStep = new CommissionCreditStep(), orders = Order, notifyAdmins = defaultNotifyAdmins, resolveStudent = null } = {}) {
    this.client = client;
    if (resolveStudent) this.resolveStudentId = resolveStudent;
    this.commissionStep = commissionStep;
    this.orders = orders;
    this.notifyAdmins = notifyAdmins;
  }

  async execute(event) {
    const { orderReference, correlationId } = event;
    const log = (msg) => console.log(`[B2cCourseSaga:${correlationId}] ${msg}`);

    if (!this.client.isConfigured()) {
      throw new EnrollmentRetryableError('SL_BACKEND_URL / INTERNAL_API_KEY absents : inscription impossible pour l’instant');
    }

    const order = await this.orders.findOne({ where: { reference: orderReference } });
    if (!order) throw new EnrollmentPermanentError(`Commande ${orderReference} introuvable`, 'ORDER_NOT_FOUND');
    const metadata = parseMetadata(order.metadata);
    const email = metadata.beneficiary_email || metadata.customer_email || order.customerEmail;
    const formationId = Number(metadata.formation_id ?? order.formationId);

    // 1. Inscription canonique (idempotente)
    const { status, data } = await this.client.enroll({
      email,
      formationId,
      orderRef: order.reference,
      lineRef: '1',
      source: 'purchase',
      ...(typeof metadata.channel_ref === 'string' && /^[A-Za-z0-9]{6,16}$/.test(metadata.channel_ref) ? { ref: metadata.channel_ref } : {}),
    }, correlationId);

    if (isRetryableEnrollmentStatus(status)) {
      throw new EnrollmentRetryableError(`Inscription non confirmée (HTTP ${status}) : nouvel essai`);
    }
    if (status !== 200 && status !== 201) {
      const code = data?.code || `HTTP_${status}`;
      await this.notifyAdmins(order, code, data?.error || data?.message || 'Inscription refusée').catch(() => undefined);
      throw new EnrollmentPermanentError(`Inscription refusée pour ${order.reference} : ${code}`, code);
    }
    const enrollment = data.data;
    log(`Inscription ${enrollment.alreadyEnrolled ? 'déjà faite' : 'créée'} (canal ${enrollment.channel})`);

    // 2. Commission de l'auteur, sur le canal VÉRIFIÉ par le backend (jamais celui déclaré par le navigateur)
    const studentId = await this.resolveStudentId(email);
    const commission = await this.commissionStep.execute({ orderReference: order.reference, studentId, correlationId, channel: enrollment.channel });

    // 3. Commande terminée
    await this.orders.update({ status: OrderStatus.COMPLETED, completedAt: new Date() }, { where: { reference: order.reference } });

    return { status: 'COMPLETED', enrollmentId: enrollment.enrollmentId, channel: enrollment.channel, alreadyEnrolled: Boolean(enrollment.alreadyEnrolled), commission };
  }

  /** Identifiant apprenant pour le crédit de commission : le backend l'a résolu ; on le relit par e-mail. */
  async resolveStudentId(email) {
    const { QueryTypes } = await import('sequelize');
    const { default: sequelize } = await import('../../config/database.js');
    const rows = await sequelize.query('SELECT ID FROM kyd4_users WHERE user_email = :email LIMIT 1', { replacements: { email: String(email ?? '').trim().toLowerCase() }, type: QueryTypes.SELECT });
    return rows[0]?.ID ? Number(rows[0].ID) : 0;
  }
}

async function defaultNotifyAdmins(order, code, message) {
  const { AdminNotificationService } = await import('../../services/admin-notification.service.js');
  await AdminNotificationService.notifyEnrollmentFailure(order.reference, { code, message, formationId: order.formationId });
}
