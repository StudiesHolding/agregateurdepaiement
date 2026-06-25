/**
 * Saga Module — Point d'entrée unique
 *
 * Exporte tous les composants de l'orchestrateur de Saga.
 * Usage : import { dispatchOrderToSaga, paymentSagaWorker } from '../saga/index.js';
 */
export { dispatchOrderToSaga, SAGA_SOURCES } from './payment-event-dispatcher.service.js';
export { resolveStrategy } from './strategy-factory.js';
export { paymentSagaWorker, paymentSagaQueue, licenseAssignQueue, createSagaWorker, dispatchPaymentEvent, dispatchLicenseAssignEvent } from './saga-queue.service.js';
export { AuctionVerificationService, AuctionVerificationError } from './auction-verification.service.js';
export { PricingService, PricingError } from './pricing.service.js';
export { M2MHttpClient } from './m2m-http-client.service.js';