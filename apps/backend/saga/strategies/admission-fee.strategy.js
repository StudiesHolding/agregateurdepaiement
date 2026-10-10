/**
 * Saga — frais d'étude de dossier d'une candidature (ADR-0016, D6 bis).
 *
 * Après un paiement confirmé (webhook signé) :
 *   1. le backend métier marque les frais réglés (idempotent) et envoie le dossier s'il est complet ;
 *   2. commande marquée COMPLETED.
 * Réseau ou serveur indisponible → nouvel essai (BullMQ) sans doublon ; refus définitif → commande à vérifier,
 * administrateurs prévenus. Le reversement des frais à l'établissement reste à décider (aucun crédit ici).
 */
import { Order } from '../../models/index.js';
import { OrderStatus } from '../../enums/index.js';
import { SlBackendAdmissionClient, isRetryableAdmissionStatus } from '../../services/sl-backend-admission.client.js';

export class AdmissionFeeRetryableError extends Error {
  constructor(message) { super(message); this.name = 'AdmissionFeeRetryableError'; }
}
export class AdmissionFeePermanentError extends Error {
  constructor(message, code) { super(message); this.name = 'AdmissionFeePermanentError'; this.code = code; }
}

const parseMetadata = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw;
};

export class AdmissionFeeSagaStrategy {
  constructor({ client = new SlBackendAdmissionClient(), orders = Order, notifyAdmins = defaultNotifyAdmins } = {}) {
    this.client = client;
    this.orders = orders;
    this.notifyAdmins = notifyAdmins;
  }

  async execute(event) {
    const { orderReference, correlationId } = event;
    if (!this.client.isConfigured()) throw new AdmissionFeeRetryableError('SL_BACKEND_URL / INTERNAL_API_KEY absents : frais non confirmés pour l’instant');

    const order = await this.orders.findOne({ where: { reference: orderReference } });
    if (!order) throw new AdmissionFeePermanentError(`Commande ${orderReference} introuvable`, 'ORDER_NOT_FOUND');
    const metadata = parseMetadata(order.metadata);
    const candidatureId = Number(metadata.admission_candidature_id);
    if (!Number.isInteger(candidatureId) || candidatureId <= 0) {
      await this.notifyAdmins(order, 'CANDIDATURE_MISSING', 'Commande de frais sans candidature').catch(() => undefined);
      throw new AdmissionFeePermanentError(`Candidature absente pour ${orderReference}`, 'CANDIDATURE_MISSING');
    }

    const { status, data } = await this.client.feePaid(candidatureId, order.reference, correlationId);
    if (isRetryableAdmissionStatus(status)) throw new AdmissionFeeRetryableError(`Frais non confirmés (HTTP ${status}) : nouvel essai`);
    if (status !== 200) {
      const code = data?.code || `HTTP_${status}`;
      await this.notifyAdmins(order, code, data?.error?.message || data?.message || 'Frais refusés par le backend').catch(() => undefined);
      throw new AdmissionFeePermanentError(`Frais refusés pour ${order.reference} : ${code}`, code);
    }

    await this.orders.update({ status: OrderStatus.COMPLETED, completedAt: new Date() }, { where: { reference: order.reference } });
    console.log(`[AdmissionFeeSaga:${correlationId}] frais réglés pour la candidature ${candidatureId}${data?.data?.submitted ? ' — dossier envoyé' : ''}`);
    return { status: 'COMPLETED', candidatureId, submitted: Boolean(data?.data?.submitted) };
  }
}

async function defaultNotifyAdmins(order, code, message) {
  const { AdminNotificationService } = await import('../../services/admin-notification.service.js');
  await AdminNotificationService.notifyEnrollmentFailure(order.reference, { code, message, formationId: order.formationId });
}
