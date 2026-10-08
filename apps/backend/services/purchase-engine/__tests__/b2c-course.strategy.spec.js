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

  describe('coupons (ADR-0012, D6 bis)', () => {
    const RES = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const okQuote = (over = {}) => ({ valid: true, code: 'MOINS20', label: null, currency: 'XAF', listAmount: '25000', discountAmount: '5000', finalAmount: '20000', funder: 'author', capped: false, reservationId: RES, ...over });
    const setup = (reserveResult, enrollResult = { status: 201, data: { data: { channel: 'direct' } } }) => {
      const fetchIntent = jest.fn(async () => ({ status: 200, body: { success: true, data: PURCHASABLE } }));
      const coupons = {
        reserve: jest.fn(async () => reserveResult),
        release: jest.fn(async () => ({ status: 200, data: {} })),
        confirm: jest.fn(async () => ({ status: 200, data: {} })),
        quote: jest.fn(async () => ({ status: 200, data: { data: okQuote() } })),
      };
      const enrollment = { enroll: jest.fn(async () => enrollResult) };
      return { strategy: new B2cCoursePurchaseStrategy(fetchIntent, coupons, enrollment), coupons, enrollment };
    };

    it('code valide → montant payé = prix calculé par le backend, coupon tracé sur la commande', async () => {
      const { strategy, coupons } = setup({ status: 200, data: { data: okQuote() } });
      await strategy.process({ itemId: 12, customerEmail: 'a@test.cm', couponCode: ' moins20 ' });
      expect(coupons.reserve).toHaveBeenCalledWith('moins20', 12, 'a@test.cm');
      const call = mockInitializePayment.mock.calls[0][0];
      expect(call.amount).toBe(20000);
      expect(call.metadata).toMatchObject({ coupon_code: 'MOINS20', coupon_reservation_id: RES, coupon_list_amount: '25000', coupon_funder: 'author' });
    });

    it('code refusé → 409 avec le motif, aucun paiement', async () => {
      const { strategy } = setup({ status: 200, data: { data: { valid: false, reason: 'EXPIRED', message: 'Ce code a expiré.' } } });
      await expect(strategy.process({ itemId: 12, customerEmail: 'a@test.cm', couponCode: 'VIEUX' })).rejects.toMatchObject({ statusCode: 409, message: 'Ce code a expiré.' });
      expect(mockInitializePayment).not.toHaveBeenCalled();
    });

    it('service des codes indisponible → 503, aucun paiement au prix plein par surprise', async () => {
      const { strategy } = setup({ status: 503, data: {} });
      await expect(strategy.process({ itemId: 12, customerEmail: 'a@test.cm', couponCode: 'MOINS20' })).rejects.toMatchObject({ statusCode: 503 });
      expect(mockInitializePayment).not.toHaveBeenCalled();
    });

    it('devise de la réservation différente de celle de la formation → réservation libérée, 502', async () => {
      const { strategy, coupons } = setup({ status: 200, data: { data: okQuote({ currency: 'EUR' }) } });
      await expect(strategy.process({ itemId: 12, customerEmail: 'a@test.cm', couponCode: 'MOINS20' })).rejects.toMatchObject({ statusCode: 502 });
      expect(coupons.release).toHaveBeenCalledWith(RES);
    });

    it('échec d\'initialisation du paiement → réservation libérée', async () => {
      const { strategy, coupons } = setup({ status: 200, data: { data: okQuote() } });
      mockInitializePayment.mockResolvedValueOnce({ success: false, error: 'PSP indisponible' });
      await expect(strategy.process({ itemId: 12, customerEmail: 'a@test.cm', couponCode: 'MOINS20' })).rejects.toThrow('PSP indisponible');
      expect(coupons.release).toHaveBeenCalledWith(RES);
    });

    it('coupon à 100 % → aucune transaction, inscription coupon_free puis confirmation', async () => {
      const { strategy, coupons, enrollment } = setup({ status: 200, data: { data: okQuote({ funder: 'platform', discountAmount: '25000', finalAmount: '0' }) } });
      const result = await strategy.process({ itemId: 12, customerEmail: 'a@test.cm', couponCode: 'OFFERT', ref: 'Ab12Cd34' });
      expect(mockInitializePayment).not.toHaveBeenCalled();
      expect(enrollment.enroll.mock.calls[0][0]).toMatchObject({ email: 'a@test.cm', formationId: 12, source: 'coupon_free', orderRef: `COUPON-${RES}`, ref: 'Ab12Cd34' });
      expect(coupons.confirm).toHaveBeenCalledWith(RES, `COUPON-${RES}`);
      expect(result).toMatchObject({ status: 'COMPLETED', transactionId: `COUPON-${RES}` });
    });

    it('coupon à 100 % sans compte apprenant → réservation libérée, message clair', async () => {
      const { strategy, coupons } = setup({ status: 200, data: { data: okQuote({ finalAmount: '0', discountAmount: '25000' }) } }, { status: 404, data: { code: 'USER_NOT_FOUND' } });
      await expect(strategy.process({ itemId: 12, customerEmail: 'inconnu@test.cm', couponCode: 'OFFERT' })).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('créez votre compte') });
      expect(coupons.release).toHaveBeenCalledWith(RES);
      expect(coupons.confirm).not.toHaveBeenCalled();
    });
  });
});
