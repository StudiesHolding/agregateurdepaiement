/**
 * Sécurité des stratégies d'achat (06/10/2026) : aucun prix venu du navigateur,
 * aucun faux contexte en repli, licences plafonnées.
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

  it('enchère : plus de paiement simulé (501), jamais d\'URL de PSP fictive', async () => {
    const strategy = new AuctionPaymentStrategy();
    await expect(strategy.process({ itemId: 9 })).rejects.toMatchObject({ statusCode: 501 });
  });

  it('enchère : service injoignable → 503, jamais de faux contexte à 150 EUR', async () => {
    mockAxiosGet.mockRejectedValue(new Error('ECONNREFUSED'));
    const strategy = new AuctionPaymentStrategy();
    await expect(strategy.getContext(9)).rejects.toMatchObject({ statusCode: 503 });
  });

  describe('package : licences plafonnées au maximum du package', () => {
    const PKG = { id: 5, name: 'Pack Managers', price: '500000', currency: 'XAF', max_licenses: 20 };

    it.each([[21], [10000], [0], [-4], ['abc'], [2.5]])('%p licences → 400, aucun paiement', async (count) => {
      mockPackageFindByPk.mockResolvedValue(PKG);
      const strategy = new B2bPackagePurchaseStrategy();
      await expect(strategy.initiatePayment({ itemId: 5, totalLicenses: count, adminEmail: 'rh@entreprise.cm' }))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(mockInitializePayment).not.toHaveBeenCalled();
    });

    it('20 licences (maximum) → paiement au prix serveur du package', async () => {
      mockPackageFindByPk.mockResolvedValue(PKG);
      const strategy = new B2bPackagePurchaseStrategy();
      await strategy.initiatePayment({ itemId: 5, totalLicenses: 20, adminEmail: 'rh@entreprise.cm', amount: 1 });
      expect(mockInitializePayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 500000, currency: 'XAF' }));
    });

    it('licences non précisées → maximum du package', async () => {
      mockPackageFindByPk.mockResolvedValue(PKG);
      const strategy = new B2bPackagePurchaseStrategy();
      await strategy.initiatePayment({ itemId: 5, adminEmail: 'rh@entreprise.cm' });
      const metadata = mockInitializePayment.mock.calls[0][0].metadata;
      expect(JSON.stringify(metadata)).toContain('20');
    });
  });
});
