/**
 * Tests unitaires — PaymentSagaWorker (S1-8)
 *
 * Critères d'acceptation :
 * - SUCCESS ⇒ événement sauté ;
 * - PROCESSING / RETRYING / absent ⇒ ré-exécuté (rejeu BullMQ après une
 *   erreur réessayable ou un plantage du worker) ;
 * - entrée en traitement = upsert INSERT … ON DUPLICATE KEY UPDATE
 *   (created_at non touché, valeurs en replacements) ;
 * - erreur réessayable ⇒ statut RETRYING + message, erreur relancée ;
 * - erreur définitive ⇒ statut FAILED, erreur relancée.
 *
 * Mode ESM : jest.unstable_mockModule + imports dynamiques.
 */
import { jest, describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';

// ============================================================
// Mocks ESM avec jest.unstable_mockModule
// ============================================================
const mockDbQuery = jest.fn();
const mockCreateSagaWorker = jest.fn().mockReturnValue({ on: jest.fn() });
const mockResolveStrategy = jest.fn();
const mockStrategyExecute = jest.fn();

jest.unstable_mockModule('../../config/database.js', () => ({
  __esModule: true,
  default: { query: mockDbQuery },
}));

jest.unstable_mockModule('../saga-queue.service.js', () => ({
  __esModule: true,
  createSagaWorker: mockCreateSagaWorker,
}));

jest.unstable_mockModule('../strategy-factory.js', () => ({
  __esModule: true,
  resolveStrategy: mockResolveStrategy,
}));

describe('PaymentSagaWorker — idempotence et rejeu', () => {
  let processPaymentSaga;
  let paymentSagaWorker;

  const job = {
    id: 'job-1',
    data: {
      eventId: 'order-paid-CMD-W-001',
      source: 'B2B_PACKAGE',
      orderReference: 'CMD-W-001',
      correlationId: 'corr-worker-001',
      payload: { orderReference: 'CMD-W-001' },
    },
  };

  // Statut renvoyé par la table d'idempotence au SELECT initial
  let idempotencyStatus = null;
  // Enregistrement du worker observé à l'import du module (avant tout clear)
  let workerRegistration = null;

  beforeAll(async () => {
    const mod = await import('../payment-saga.worker.js');
    processPaymentSaga = mod.processPaymentSaga;
    paymentSagaWorker = mod.paymentSagaWorker;
    workerRegistration = mockCreateSagaWorker.mock.calls.map((c) => [...c]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    idempotencyStatus = null;
    mockDbQuery.mockImplementation(async (sql) => {
      if (sql.includes('SELECT status')) {
        return idempotencyStatus ? [{ status: idempotencyStatus }] : [];
      }
      return [1];
    });
    mockResolveStrategy.mockReturnValue({
      constructor: { name: 'B2BPackageStrategy' },
      execute: mockStrategyExecute,
    });
    mockStrategyExecute.mockResolvedValue({ success: true, orderReference: 'CMD-W-001' });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  const queries = () => mockDbQuery.mock.calls.map((c) => ({ sql: c[0], options: c[1] }));

  it('TC-WRK-01: le worker est enregistré sur la file saga-payment avec processPaymentSaga', () => {
    expect(workerRegistration).toHaveLength(1);
    expect(workerRegistration[0][0]).toBe('saga-payment');
    expect(workerRegistration[0][1]).toBe(processPaymentSaga);
    expect(typeof processPaymentSaga).toBe('function');
    expect(paymentSagaWorker).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────
  // Critère : SUCCESS ⇒ sauté
  // ─────────────────────────────────────────────────────────
  it('TC-WRK-02: événement SUCCESS ⇒ sauté, stratégie non exécutée', async () => {
    idempotencyStatus = 'SUCCESS';

    const result = await processPaymentSaga(job);

    expect(result).toEqual({ skipped: true, eventId: 'order-paid-CMD-W-001' });
    expect(mockStrategyExecute).not.toHaveBeenCalled();
    // Seul le SELECT d'idempotence a été exécuté
    expect(mockDbQuery).toHaveBeenCalledTimes(1);
  });

  // ─────────────────────────────────────────────────────────
  // Critère : PROCESSING / RETRYING / absent ⇒ ré-exécuté
  // ─────────────────────────────────────────────────────────
  it.each([
    ['PROCESSING', 'PROCESSING'],
    ['RETRYING', 'RETRYING'],
    ['absent (première tentative)', null],
  ])('TC-WRK-03: événement %s ⇒ stratégie ré-exécutée puis SUCCESS', async (_label, status) => {
    idempotencyStatus = status;

    const result = await processPaymentSaga(job);

    expect(mockStrategyExecute).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, orderReference: 'CMD-W-001' });

    // SELECT → upsert PROCESSING → UPDATE SUCCESS
    const qs = queries();
    expect(qs).toHaveLength(3);
    expect(qs[1].options.replacements).toEqual(
      expect.objectContaining({
        eventId: 'order-paid-CMD-W-001',
        status: 'PROCESSING',
        orderReference: 'CMD-W-001',
        source: 'B2B_PACKAGE',
      })
    );
    expect(qs[2].options.replacements).toEqual(
      expect.objectContaining({ eventId: 'order-paid-CMD-W-001', status: 'SUCCESS' })
    );
  });

  // ─────────────────────────────────────────────────────────
  // Critère : upsert de l'entrée en traitement
  // ─────────────────────────────────────────────────────────
  it('TC-WRK-04: entrée en traitement = upsert ON DUPLICATE KEY UPDATE sans toucher created_at', async () => {
    await processPaymentSaga(job);

    const upsert = queries().find((q) => q.sql.includes('INSERT INTO aggp_saga_idempotency'));
    expect(upsert).toBeDefined();
    expect(upsert.sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(upsert.sql).toContain("ON DUPLICATE KEY UPDATE status = 'PROCESSING'");
    // created_at n'est posé qu'à l'INSERT, jamais modifié par l'upsert
    expect(upsert.sql).not.toMatch(/ON DUPLICATE KEY UPDATE.*created_at/s);
    // Valeurs bindées (replacements), pas de concaténation
    expect(upsert.options.replacements).toEqual({
      eventId: 'order-paid-CMD-W-001',
      status: 'PROCESSING',
      orderReference: 'CMD-W-001',
      source: 'B2B_PACKAGE',
    });
  });

  // ─────────────────────────────────────────────────────────
  // Critère : erreur réessayable ⇒ RETRYING + relance
  // ─────────────────────────────────────────────────────────
  it.each([
    ['MoodleRetryableError', 'moodle indisponible'],
    ['CommissionRetryableError', 'backend commission 503'],
  ])('TC-WRK-05: erreur réessayable %s ⇒ statut RETRYING enregistré et erreur relancée', async (name, message) => {
    const error = new Error(message);
    error.name = name;
    mockStrategyExecute.mockRejectedValueOnce(error);

    await expect(processPaymentSaga(job)).rejects.toThrow(message);

    const last = queries().at(-1);
    expect(last.options.replacements).toEqual(
      expect.objectContaining({ eventId: 'order-paid-CMD-W-001', status: 'RETRYING', error: message })
    );
  });

  // ─────────────────────────────────────────────────────────
  // Critère : erreur définitive ⇒ FAILED + relance
  // ─────────────────────────────────────────────────────────
  it('TC-WRK-06: erreur définitive ⇒ statut FAILED enregistré et erreur relancée', async () => {
    mockStrategyExecute.mockRejectedValueOnce(new Error('formation inconnue'));

    await expect(processPaymentSaga(job)).rejects.toThrow('formation inconnue');

    const last = queries().at(-1);
    expect(last.options.replacements).toEqual(
      expect.objectContaining({ eventId: 'order-paid-CMD-W-001', status: 'FAILED', error: 'formation inconnue' })
    );
  });

  it('TC-WRK-07: le message d\'erreur est bindé en replacement (jamais concaténé dans le SQL)', async () => {
    const malicious = "x'; DROP TABLE aggp_saga_idempotency; --";
    mockStrategyExecute.mockRejectedValueOnce(new Error(malicious));

    await expect(processPaymentSaga(job)).rejects.toThrow(malicious);

    const last = queries().at(-1);
    expect(last.sql).not.toContain('DROP TABLE');
    expect(last.options.replacements.error).toBe(malicious);
  });
});
