/**
 * Sécurité des stratégies d'achat (06/10/2026) : aucun prix venu du navigateur,
 * aucun faux contexte en repli, licences validées par le devis serveur.
 */
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

const mockPackageFindByPk = jest.fn();
jest.unstable_mockModule('../../../models/index.js', () => ({
  FormationPackage: { findByPk: mockPackageFindByPk },
}));

const mockInitializePayment = jest.fn();
jest.unstable_mockModule('../../orchestrator.service.js', () => ({
  OrchestratorService: { initializePayment: mockInitializePayment },
}));

const mockAxiosGet = jest.fn();
jest.unstable_mockModule('axios', () => ({ __esModule: true, default: { get: mockAxiosGet } }));

describe('Stratégies d\'achat — fermeture sécurisée', () => {
  let B2bThematiquePurchaseStrategy, AuctionPaymentStrategy, B2bPackagePurchaseStrategy;

  beforeAll(async () => {
    ({ B2bThematiquePurchaseStrategy } = await import('../b2b-thematique.strategy.js'));
    ({ AuctionPaymentStrategy } = await import('../auction-payment.strategy.js'));
    ({ B2bPackagePurchaseStrategy } = await import('../b2b-package.strategy.js'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockInitializePayment.mockResolvedValue({ success: true, orderReference: 'ORD-1', provider: 'cinetpay' });
  });

  const QUOTE = {
    thematiqueId: 3, title: 'Leadership', typeName: 'Premium', seats: 25, currency: 'XAF',
    basePrice: '50000.00', unitPrice: '45000.00', discountRate: '0.1000', discountLabel: 'Équipe',
    total: '1125000.00', breakpoint: { id: 1, minSeats: 10, maxSeats: 49 },
  };

  it('thématique : le total payé est le devis serveur, jamais le montant du navigateur', async () => {
    const quoteService = { quote: jest.fn(async () => QUOTE) };
    const strategy = new B2bThematiquePurchaseStrategy(quoteService);
    await strategy.initiatePayment({ itemId: 3, totalLicenses: 25, amount: 1, currency: 'EUR', adminEmail: 'rh@entreprise.cm' });
    expect(quoteService.quote).toHaveBeenCalledWith(3, 25);
    expect(mockInitializePayment).toHaveBeenCalledWith(expect.objectContaining({
      amount: 1125000,
      currency: 'XAF',
      metadata: expect.objectContaining({ thematique_id: 3, licence_count: 25, unit_price: '45000.00', discount_label: 'Équipe' }),
    }));
  });

  it('thématique : devis refusé (licences invalides, thématique inactive) → aucun paiement', async () => {
    const refusal = Object.assign(new Error('Nombre de licences invalide'), { statusCode: 400 });
    const strategy = new B2bThematiquePurchaseStrategy({ quote: jest.fn(async () => { throw refusal; }) });
    await expect(strategy.initiatePayment({ itemId: 3, totalLicenses: 0, adminEmail: 'rh@entreprise.cm' }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockInitializePayment).not.toHaveBeenCalled();
  });

  it("enchère : sans jeton d'invitation, aucun paiement (jamais de montant venu du navigateur)", async () => {
    const strategy = new AuctionPaymentStrategy({ isConfigured: () => true, check: jest.fn() });
    await expect(strategy.process({ itemId: 9, amount: 1 })).rejects.toMatchObject({ statusCode: 400 });
    expect(mockInitializePayment).not.toHaveBeenCalled();
  });

  it('enchère : service injoignable → 503, jamais de faux contexte à 150 EUR', async () => {
    const strategy = new AuctionPaymentStrategy({ isConfigured: () => true, check: jest.fn(async () => ({ status: 503, data: {} })) });
    await expect(strategy.getContext(9, { claim: 'a'.repeat(43) })).rejects.toMatchObject({ statusCode: 503 });
  });

  describe('package : vendu à la licence, prix serveur', () => {
    const PKG_QUOTE = {
      packageId: 5, name: 'Pack Managers', seats: 7, currency: 'XOF',
      basePrice: '25000.00', unitPrice: '23750.00', discountRate: '0.0500', discountLabel: '5-9 sièges',
      total: '166250.00', breakpoint: { id: 6, minSeats: 5, maxSeats: 9 },
    };

    it('le total payé est le devis serveur (prix × licences − palier), jamais le montant du navigateur', async () => {
      const quoteService = { quote: jest.fn(async () => PKG_QUOTE) };
      const strategy = new B2bPackagePurchaseStrategy(quoteService);
      await strategy.initiatePayment({ itemId: 5, totalLicenses: 7, amount: 1, currency: 'EUR', adminEmail: 'rh@entreprise.cm' });
      expect(quoteService.quote).toHaveBeenCalledWith(5, 7);
      expect(mockInitializePayment).toHaveBeenCalledWith(expect.objectContaining({
        amount: 166250,
        currency: 'XOF',
        lmsItemType: 'package',
        metadata: expect.objectContaining({ package_id: 5, licence_count: 7, unit_price: '23750.00', discount_label: '5-9 sièges' }),
      }));
    });

    it('devis refusé (licences absentes ou invalides, package non vendable) → aucun paiement', async () => {
      const refusal = Object.assign(new Error('Nombre de licences invalide'), { statusCode: 400 });
      const strategy = new B2bPackagePurchaseStrategy({ quote: jest.fn(async () => { throw refusal; }) });
      for (const totalLicenses of [undefined, 0, 'abc']) {
        await expect(strategy.initiatePayment({ itemId: 5, totalLicenses, adminEmail: 'rh@entreprise.cm' }))
          .rejects.toMatchObject({ statusCode: 400 });
      }
      expect(mockInitializePayment).not.toHaveBeenCalled();
    });

    it('e-mail administrateur absent → 400 avant tout devis', async () => {
      const quoteService = { quote: jest.fn() };
      const strategy = new B2bPackagePurchaseStrategy(quoteService);
      await expect(strategy.initiatePayment({ itemId: 5, totalLicenses: 2 })).rejects.toMatchObject({ statusCode: 400 });
      expect(quoteService.quote).not.toHaveBeenCalled();
    });

    it('contexte : prix affiché = prix d\'une licence issu du devis serveur', async () => {
      const quoteService = { quote: jest.fn(async () => ({ ...PKG_QUOTE, seats: 1, unitPrice: '25000.00', total: '25000.00' })) };
      const model = { findByPk: jest.fn(async () => ({ description: 'Managers', benefits: '["Coaching"]', price: '1' })) };
      const context = await new B2bPackagePurchaseStrategy(quoteService, model).getContext(5);
      expect(quoteService.quote).toHaveBeenCalledWith(5, 1);
      expect(context).toMatchObject({ itemId: 5, price: 25000, currency: 'XOF', features: ['Coaching'], pricing: { unit: 'licence' } });
    });
  });
});
