/**
 * Tests unitaires — PaymentEventDispatcher (S1-8)
 *
 * Critères d'acceptation :
 * - eventId déterministe par inscription (`order-paid-<reference>`) : deux
 *   dispatchs de la même inscription produisent le MÊME eventId → la
 *   déduplication BullMQ (jobId) et la table aggp_saga_idempotency protègent
 *   réellement le rejeu.
 * - companyId présent dans les payloads B2B_PACKAGE / B2B_THEMATIQUE si
 *   metadata.company_id est un entier > 0, sinon null.
 *
 * Mode ESM : jest.unstable_mockModule + imports dynamiques.
 */
import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';

// ============================================================
// Mocks ESM avec jest.unstable_mockModule
// ============================================================
const mockDispatchPaymentEvent = jest.fn().mockResolvedValue({ id: 'job-42' });

jest.unstable_mockModule('../saga-queue.service.js', () => ({
  __esModule: true,
  dispatchPaymentEvent: mockDispatchPaymentEvent,
}));

describe('PaymentEventDispatcher — eventId déterministe et companyId', () => {
  let dispatchOrderToSaga, SAGA_SOURCES;

  const baseOrder = {
    reference: 'CMD-B2B-001',
    customerEmail: 'manager@acme.com',
    customerName: 'Jean',
    customerSurname: 'Dupont',
    formationId: 42,
    formationName: 'Package Leadership',
    currency: 'EUR',
    totalAmount: 750.0,
    lmsItemId: 42,
  };

  const b2bPackageMetadata = {
    is_b2b: true,
    company_id: 5,
    company_name: 'Acme SARL',
    company_admin_email: 'manager@acme.com',
    licence_count: 10,
    unit_price: 75,
  };

  const lastDispatchedEvent = () => mockDispatchPaymentEvent.mock.calls[mockDispatchPaymentEvent.mock.calls.length - 1][0];

  beforeAll(async () => {
    const mod = await import('../payment-event-dispatcher.service.js');
    dispatchOrderToSaga = mod.dispatchOrderToSaga;
    SAGA_SOURCES = mod.SAGA_SOURCES;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDispatchPaymentEvent.mockResolvedValue({ id: 'job-42' });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // Critère 1 : eventId déterministe par inscription
  // ─────────────────────────────────────────────────────────
  it('TC-DIS-01: deux dispatchs de la même inscription ⇒ même eventId `order-paid-<reference>`', async () => {
    const order = { ...baseOrder, metadata: { ...b2bPackageMetadata } };

    const first = await dispatchOrderToSaga(order, 'corr-1');
    const second = await dispatchOrderToSaga(order, 'corr-2');

    expect(first.eventId).toBe('order-paid-CMD-B2B-001');
    expect(second.eventId).toBe('order-paid-CMD-B2B-001');
    expect(second.eventId).toBe(first.eventId);
    expect(first.jobId).toBe('job-42');
    expect(mockDispatchPaymentEvent).toHaveBeenCalledTimes(2);

    // L'eventId déterministe est bien celui passé à la queue (jobId BullMQ)
    expect(lastDispatchedEvent().eventId).toBe('order-paid-CMD-B2B-001');
  });

  it('TC-DIS-02: deux inscriptions différentes ⇒ deux eventIds distincts', async () => {
    const first = await dispatchOrderToSaga(
      { ...baseOrder, metadata: { ...b2bPackageMetadata } }, 'corr-1'
    );
    const second = await dispatchOrderToSaga(
      { ...baseOrder, reference: 'CMD-B2B-002', metadata: { ...b2bPackageMetadata } }, 'corr-2'
    );

    expect(first.eventId).toBe('order-paid-CMD-B2B-001');
    expect(second.eventId).toBe('order-paid-CMD-B2B-002');
    expect(second.eventId).not.toBe(first.eventId);
  });

  // ─────────────────────────────────────────────────────────
  // Critère 2 : companyId dans les payloads B2B
  // ─────────────────────────────────────────────────────────
  it('TC-DIS-03: B2B_PACKAGE avec metadata.company_id entier ⇒ payload.companyId', async () => {
    const result = await dispatchOrderToSaga(
      { ...baseOrder, metadata: { ...b2bPackageMetadata, company_id: 5 } }, 'corr-1'
    );

    expect(result.source).toBe(SAGA_SOURCES.B2B_PACKAGE);
    expect(lastDispatchedEvent().payload.companyId).toBe(5);
  });

  it('TC-DIS-04: metadata.company_id en chaîne numérique ⇒ Number(...) entier', async () => {
    await dispatchOrderToSaga(
      { ...baseOrder, metadata: { ...b2bPackageMetadata, company_id: '7' } }, 'corr-1'
    );

    expect(lastDispatchedEvent().payload.companyId).toBe(7);
  });

  it.each([
    ['absente', undefined],
    ['nulle', null],
    ['zéro', 0],
    ['négative', -3],
    ['non numérique', 'abc'],
    ['décimale', 12.5],
  ])('TC-DIS-05: metadata.company_id %s ⇒ payload.companyId null', async (_label, company_id) => {
    await dispatchOrderToSaga(
      { ...baseOrder, metadata: { ...b2bPackageMetadata, company_id } }, 'corr-1'
    );

    expect(lastDispatchedEvent().payload.companyId).toBeNull();
  });

  it('TC-DIS-06: B2B_THEMATIQUE (purchase_type=thematique) ⇒ companyId présent', async () => {
    const result = await dispatchOrderToSaga(
      {
        ...baseOrder,
        metadata: { purchase_type: 'thematique', company_id: 9, thematique_id: 3 },
      },
      'corr-1'
    );

    expect(result.source).toBe(SAGA_SOURCES.B2B_THEMATIQUE);
    expect(lastDispatchedEvent().payload.companyId).toBe(9);
  });

  it('TC-DIS-07: source RETAIL (ni B2B ni thématique) ⇒ payload sans companyId', async () => {
    const result = await dispatchOrderToSaga(
      { ...baseOrder, metadata: { purchase_type: 'self' } }, 'corr-1'
    );

    expect(result.source).toBe(SAGA_SOURCES.RETAIL);
    expect(lastDispatchedEvent().payload.companyId).toBeUndefined();
  });

  it('TC-DIS-BULLMQ: l\'eventId (jobId BullMQ) ne contient jamais « : »', async () => {
    const { dispatchOrderToSaga } = await import('../payment-event-dispatcher.service.js');
    const event = await dispatchOrderToSaga({ reference: 'CMD:WITH:COLONS', metadata: { is_b2b: true } });
    expect(event.eventId).toBe('order-paid-CMD-WITH-COLONS');
    expect(event.eventId).not.toContain(':');
  });
});
