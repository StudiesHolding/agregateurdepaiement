/**
 * Tests unitaires — B2cCoursePurchaseStrategy (S1-7b)
 * Le backend métier (enroll-intent) et l'orchestrateur PSP sont simulés.
 */
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

const mockInitializePayment = jest.fn();
jest.unstable_mockModule('../../orchestrator.service.js', () => ({
  OrchestratorService: { initializePayment: mockInitializePayment },
}));

const PURCHASABLE = {
  formationId: 12,
  title: 'Gestion de projet agile',
  accessType: 'paid',
  price: 25000,
  currency: 'XAF',
  thumbnailUrl: 'https://cdn.test/agile.webp',
  purchasable: true,
};

describe('B2cCoursePurchaseStrategy', () => {
  let B2cCoursePurchaseStrategy;

  beforeAll(async () => {
    ({ B2cCoursePurchaseStrategy } = await import('../b2c-course.strategy.js'));
  });

  beforeEach(() => {
    mockInitializePayment.mockReset();
    mockInitializePayment.mockResolvedValue({
      success: true, orderReference: 'ORD-1', provider: 'cinetpay', redirectUrl: 'https://psp.test/pay',
    });
  });

  const strategyReturning = (status, data) => {
    const fetchIntent = jest.fn(async () => ({ status, body: data === undefined ? null : { success: true, data } }));
    return { strategy: new B2cCoursePurchaseStrategy(fetchIntent), fetchIntent };
  };

  it('identifiant non entier → 400 sans appel réseau', async () => {
    const { strategy, fetchIntent } = strategyReturning(200, PURCHASABLE);
    for (const bad of ['abc', '12.5', '-3', '0', '', null, 'a1b2c3d4-uuid']) {
      await expect(strategy.getContext(bad)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(fetchIntent).not.toHaveBeenCalled();
  });

  it('formation achetable → contexte avec identifiant entier, prix et devise du backend', async () => {
    const { strategy, fetchIntent } = strategyReturning(200, PURCHASABLE);
    const context = await strategy.getContext('12');
    expect(fetchIntent).toHaveBeenCalledWith(12);
    expect(context).toMatchObject({
      type: 'B2C_COURSE', itemId: 12, title: 'Gestion de projet agile', price: 25000, currency: 'XAF',
    });
  });

  it('formation gratuite, introuvable, non prête ou backend injoignable → erreurs explicites', async () => {
    await expect(strategyReturning(200, { ...PURCHASABLE, accessType: 'free', price: 0 }).strategy.getContext(12))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(strategyReturning(404).strategy.getContext(12)).rejects.toMatchObject({ statusCode: 404 });
    await expect(strategyReturning(200, { ...PURCHASABLE, purchasable: false, unavailableReason: 'COURSE_NOT_READY' })
      .strategy.getContext(12)).rejects.toMatchObject({ statusCode: 409 });
    await expect(strategyReturning(0).strategy.getContext(12)).rejects.toMatchObject({ statusCode: 503 });
  });

  it('SÉCURITÉ : le prix et la devise envoyés par le navigateur sont ignorés', async () => {
    const { strategy } = strategyReturning(200, PURCHASABLE);
    await strategy.process({
      itemId: '12', customerEmail: 'apprenant@test.cm', amount: 1, currency: 'EUR', paymentMethod: 'mobile_money',
    });
    expect(mockInitializePayment).toHaveBeenCalledWith(expect.objectContaining({
      amount: 25000,
      currency: 'XAF',
      lmsItemId: '12',
      metadata: expect.objectContaining({ formation_id: 12, purchase_type: 'B2C_COURSE', channel: 'direct' }),
    }));
  });

  it('la commande porte un formation_id entier et le lien d\'affiliation sûr', async () => {
    const { strategy } = strategyReturning(200, PURCHASABLE);
    await strategy.process({ itemId: 12, customerEmail: 'a@test.cm', ref: 'Ab12Cd34' });
    expect(mockInitializePayment.mock.calls[0][0].metadata).toMatchObject({ formation_id: 12, channel_ref: 'Ab12Cd34' });

    mockInitializePayment.mockClear();
    await strategy.process({ itemId: 12, customerEmail: 'a@test.cm', ref: '<script>' });
    expect(mockInitializePayment.mock.calls[0][0].metadata.channel_ref).toBeNull();
  });

  it('formation devenue non achetable au moment du paiement → aucun paiement initié', async () => {
    const { strategy } = strategyReturning(200, { ...PURCHASABLE, purchasable: false, unavailableReason: 'COURSE_NOT_READY' });
    await expect(strategy.process({ itemId: 12, customerEmail: 'a@test.cm' })).rejects.toMatchObject({ statusCode: 409 });
    expect(mockInitializePayment).not.toHaveBeenCalled();
  });
});
