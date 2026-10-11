/**
 * PaymentEventDispatcher
 *
 * Point d'entrée unique pour dispatcher les événements de paiement
 * vers la file BullMQ après confirmation par webhook.
 *
 * Utilisé par WebhookProcessor.processEvent() après markAsSucceeded().
 */
import { dispatchPaymentEvent } from './saga-queue.service.js';

/**
 * Identifiant d'événement déterministe : deux notifications PSP pour la MÊME
 * inscription produisent le MÊME eventId → la déduplication BullMQ (jobId /
 * deduplication.id) et la table aggp_saga_idempotency protègent réellement
 * le rejeu de la même inscription.
 */
function buildEventId(order) {
  // Sert aussi de jobId BullMQ : « : » y est interdit (« Custom Id cannot contain : »).
  return `order-paid-${String(order.reference).replace(/:/g, '-')}`;
}

/**
 * Résout l'entreprise côté serveur à partir des métadonnées de l’inscription
 * (fixé par le dashboard B2B authentifié) :
 * entier > 0 sinon null (recherche par e-mail dans la stratégie).
 */
function resolveCompanyId(metadata) {
  const raw = Number(metadata?.company_id);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
}

export const SAGA_SOURCES = {
  RETAIL: 'RETAIL',
  B2C_COURSE: 'B2C_COURSE',
  ADMISSION_FEE: 'ADMISSION_FEE',
  AUCTION: 'AUCTION',
  B2B_PACKAGE: 'B2B_PACKAGE',
  B2B_THEMATIQUE: 'B2B_THEMATIQUE',
  MOODLE_HEADLESS: 'MOODLE_HEADLESS',
};

/**
 * Crée et dispatch un événement de paiement dans la file BullMQ.
 * Appelé APRES markAsSucceeded() dans le WebhookProcessor.
 *
 * @param {Object} order - Inscription aggp_orders
 * @param {string} correlationId - ID de corrélation
 * @returns {Promise<Object>} Résultat du dispatch
 */
export async function dispatchOrderToSaga(order, correlationId) {
  const metadata = parseMetadata(order.metadata);
  const source = resolveSource(metadata);

  const event = {
    eventId: buildEventId(order),
    source,
    orderReference: order.reference,
    correlationId: correlationId || `saga-${order.reference}`,
    createdAt: new Date().toISOString(),
    attempt: 0,
    payload: buildPayload(source, order, metadata),
  };

  console.log(`[PaymentEventDispatcher] Dispatching ${source} event for order ${order.reference}`);

  const job = await dispatchPaymentEvent(event);

  return {
    eventId: event.eventId,
    source,
    jobId: job.id,
    orderReference: order.reference,
  };
}

/**
 * Résout la source de l'événement à partir des métadonnées
 */
function parseMetadata(raw) {
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

/**
 * Résout la source de l'événement à partir des métadonnées
 */
function resolveSource(metadata) {
  if (metadata.source === 'AUCTION') return SAGA_SOURCES.AUCTION;
  if (metadata.purchase_type === 'B2C_COURSE') return SAGA_SOURCES.B2C_COURSE;
  if (metadata.purchase_type === 'ADMISSION_FEE') return SAGA_SOURCES.ADMISSION_FEE;
  if (metadata.purchase_type === 'thematique' || metadata.source === 'B2B_THEMATIQUE') {
    return SAGA_SOURCES.B2B_THEMATIQUE;
  }
  if (metadata.is_b2b || metadata.b2b_purchase || metadata.source === 'b2b_dashboard') {
    return SAGA_SOURCES.B2B_PACKAGE;
  }
  if (metadata.is_headless || metadata.source === 'MOODLE_HEADLESS') {
    return SAGA_SOURCES.MOODLE_HEADLESS;
  }
  return SAGA_SOURCES.RETAIL;
}

/**
 * Construit le payload spécifique selon la source
 */
function buildPayload(source, order, metadata) {
  const base = {
    customerEmail: order.customerEmail,
    customerName: order.customerName,
    customerSurname: order.customerSurname,
    orderReference: order.reference,
    amount: Number(order.totalAmount),
    currency: order.currency,
    formationName: order.formationName,
    keycloakId: metadata.keycloak_id || null,
  };

  switch (source) {
    case SAGA_SOURCES.AUCTION:
      return {
        ...base,
        formationId: String(order.formationId || metadata.formation_id || ''),
        auctionId: Number(metadata.auction_id),
        finalPrice: Number(metadata.final_price || order.totalAmount),
        winnerId: Number(metadata.winner_id),
        bidId: Number(metadata.bid_id),
        declaredRank: Number(metadata.current_winner_rank || 1),
      };

    case SAGA_SOURCES.B2B_PACKAGE:
      return {
        ...base,
        companyName: metadata.company_name || order.customerName,
        companyEmail: metadata.company_admin_email || order.customerEmail,
        adminEmail: metadata.company_admin_email || order.customerEmail,
        adminFirstName: order.customerName,
        adminLastName: order.customerSurname,
        companyId: resolveCompanyId(metadata),
        packageId: String(order.formationId || order.lmsItemId || ''),
        licenseCount: Number(metadata.licence_count || metadata.total_licenses || 1),
        unitPrice: Number(metadata.unit_price || 0),
      };

    case SAGA_SOURCES.B2B_THEMATIQUE:
      return {
        ...base,
        companyName: metadata.company_name || order.customerName,
        companyEmail: metadata.company_admin_email || order.customerEmail,
        adminEmail: metadata.company_admin_email || order.customerEmail,
        adminFirstName: order.customerName,
        adminLastName: order.customerSurname,
        companyId: resolveCompanyId(metadata),
        thematiqueId: Number(metadata.thematique_id || order.lmsItemId || 0),
        licenseCount: Number(metadata.licence_count || metadata.total_licenses || 1),
        unitPrice: Number(metadata.unit_price || 0),
      };

    case SAGA_SOURCES.MOODLE_HEADLESS:
      return {
        ...base,
        formationId: String(order.formationId || metadata.formation_id || ''),
        auctionId: metadata.auction_id ? Number(metadata.auction_id) : null,
      };

    default:
      return {
        ...base,
        formationId: String(order.formationId || metadata.formation_id || ''),
      };
  }
}