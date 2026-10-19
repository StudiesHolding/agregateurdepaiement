/**
 * Saga — inscription après une enchère remportée (ADR-0021, D4).
 *
 * Après un paiement confirmé (webhook vérifié auprès du prestataire) :
 *   1. invitation marquée payée auprès du service des enchères (idempotent ; montant et devise contrôlés) ;
 *   2. inscription au campus (idempotente) avec la source « auction » — le compte apprenant est créé s'il manque ;
 *   3. commission de l'auteur sur le canal vérifié (étape commune, idempotente) ;
 *   4. achat marqué COMPLETED.
 * Réseau ou serveur indisponible → rejoué (BullMQ). Invitation refusée (passée au suivant pendant le paiement) →
 * échec définitif : paiement encaissé sans place attribuable, l'équipe est prévenue pour traiter le cas à la main.
 */
import { Order } from '../../models/index.js';
import { OrderStatus } from '../../enums/index.js';
import { SlBackendEnrollmentClient, isRetryableEnrollmentStatus } from '../../services/sl-backend-enrollment.client.js';
import { AuctionClaimsClient } from '../../services/auction-claims.client.js';
import { CommissionCreditStep } from '../steps/commission-credit.step.js';
import { EnrollmentPermanentError, EnrollmentRetryableError, B2cCourseSagaStrategy } from './b2c-course.strategy.js';
import { parseJson } from '../../utils/json-column.js';

export class AuctionSagaStrategy {
  constructor({ client = new SlBackendEnrollmentClient(), claims = new AuctionClaimsClient(), commissionStep = new CommissionCreditStep(), orders = Order, notifyAdmins = defaultNotifyAdmins } = {}) {
    this.client = client;
    this.claims = claims;
    this.commissionStep = commissionStep;
    this.orders = orders;
    this.notifyAdmins = notifyAdmins;
  }

  async execute(event) {
    const { orderReference, correlationId } = event;
    const log = (msg) => console.log(`[AuctionSaga:${correlationId}] ${msg}`);
    if (!this.client.isConfigured() || !this.claims.isConfigured()) {
      throw new EnrollmentRetryableError('Services internes non configurés (SL_BACKEND_URL, INTERNAL_API_KEY) : nouvel essai');
    }

    const order = await this.orders.findOne({ where: { reference: orderReference } });
    if (!order) throw new EnrollmentPermanentError(`Achat ${orderReference} introuvable`, 'ORDER_NOT_FOUND');
    const meta = parseJson(order.metadata) ?? {};
    const auctionId = Number(meta.auction_id);
    const rank = Number(meta.claim_rank);
    const email = meta.beneficiary_email || order.customerEmail;
    const formationId = Number(meta.formation_id ?? order.formationId);
    if (!auctionId || !rank || !formationId) throw new EnrollmentPermanentError(`Achat ${orderReference} sans enchère ni formation`, 'AUCTION_METADATA_MISSING');

    // 1. Invitation payée (le service des enchères contrôle montant et devise)
    const paid = await this.claims.markPaid(auctionId, { rank, reference: order.reference, amount: Number(order.totalAmount), currency: order.currency });
    if (isRetryableEnrollmentStatus(paid.status)) throw new EnrollmentRetryableError(`Enchère non confirmée (HTTP ${paid.status}) : nouvel essai`);
    if (paid.status !== 200) {
      const code = paid.data?.data?.result ? `CLAIM_${String(paid.data.data.result).toUpperCase()}` : `HTTP_${paid.status}`;
      await this.notifyAdmins(order, code, "Paiement d'enchère encaissé mais invitation non valable (délai passé ou montant différent) : à traiter.").catch(() => undefined);
      throw new EnrollmentPermanentError(`Invitation refusée pour ${order.reference} : ${code}`, code);
    }
    log(`Invitation ${paid.data?.data?.result === 'already' ? 'déjà confirmée' : 'confirmée'} (enchère ${auctionId}, rang ${rank})`);

    // 2. Inscription au campus (compte créé s'il manque)
    const { status, data } = await this.client.enroll({ email, formationId, orderRef: order.reference, lineRef: '1', source: 'auction', ...(meta.customer_name ? { name: String(meta.customer_name).slice(0, 120) } : {}) }, correlationId);
    if (isRetryableEnrollmentStatus(status)) throw new EnrollmentRetryableError(`Inscription non confirmée (HTTP ${status}) : nouvel essai`);
    if (status !== 200 && status !== 201) {
      const code = data?.code || `HTTP_${status}`;
      await this.notifyAdmins(order, code, data?.error || data?.message || 'Inscription refusée').catch(() => undefined);
      throw new EnrollmentPermanentError(`Inscription refusée pour ${order.reference} : ${code}`, code);
    }
    const enrollment = data.data;

    // 3. Commission de l'auteur (canal vérifié par le backend)
    const studentId = await B2cCourseSagaStrategy.prototype.resolveStudentId(email);
    const commission = await this.commissionStep.execute({ orderReference: order.reference, studentId, correlationId, channel: enrollment.channel });

    // 4. Terminé
    await this.orders.update({ status: OrderStatus.COMPLETED, completedAt: new Date() }, { where: { reference: order.reference } });
    return { status: 'COMPLETED', auctionId, rank, enrollmentId: enrollment.enrollmentId, commission };
  }
}

async function defaultNotifyAdmins(order, code, message) {
  const { AdminNotificationService } = await import('../../services/admin-notification.service.js');
  await AdminNotificationService.notifyEnrollmentFailure(order.reference, { code, message, formationId: order.formationId });
}
