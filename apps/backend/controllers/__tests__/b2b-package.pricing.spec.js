/**
 * Dashboard B2B : achat de package et ajout de licences au devis serveur (ADR-0004).
 * Le montant et la devise envoyés par le navigateur sont ignorés.
 */
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

const mockCompanyPackageFindOne = jest.fn();
jest.unstable_mockModule('../../models/index.js', () => ({
  CompanyPackage: { findOne: mockCompanyPackageFindOne },
  FormationPackage: {}, AccessRequest: {}, Employee: {}, Course: {}, PostMeta: {},
  SpecificFormation: {}, Order: {}, BusinessThematique: {},
  Company: { findByPk: jest.fn() }, CompanyAdmin: { findByPk: jest.fn() },
  sequelize: { transaction: jest.fn() },
}));

const mockQuote = jest.fn();
jest.unstable_mockModule('../../services/pricing/package-quote.service.js', () => ({
  packageQuoteService: { quote: mockQuote },
}));
jest.unstable_mockModule('../../services/pricing/thematique-quote.service.js', () => ({
  thematiqueQuoteService: { quote: jest.fn() },
}));

const mockInitializePayment = jest.fn();
jest.unstable_mockModule('../../services/orchestrator.service.js', () => ({
  OrchestratorService: { initializePayment: mockInitializePayment },
}));

const QUOTE = {
  packageId: 1, name: 'Pack Starter', seats: 7, currency: 'XOF',
  basePrice: '25000.00', unitPrice: '23750.00', discountRate: '0.0500', discountLabel: '5-9 sièges',
  total: '166250.00', breakpoint: { id: 6, minSeats: 5, maxSeats: 9 },
};

const response = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('b2bPackageController — prix des licences de package', () => {
  let controller;
  beforeAll(async () => {
    ({ b2bPackageController: controller } = await import('../b2b-package.controller.js'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuote.mockResolvedValue(QUOTE);
    mockInitializePayment.mockResolvedValue({ success: true, orderReference: 'ORD-9', provider: 'cinetpay' });
  });

  const company = { company_id: 42, company_email: 'rh@entreprise.cm', company_name: 'ACME' };

  it('achat : montant et devise = devis serveur, jamais ceux du navigateur', async () => {
    const res = response();
    const next = jest.fn();
    await controller.purchasePackage(
      { ...company, body: { package_id: 1, total_licenses: 7, amount: 1, currency: 'EUR' } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockQuote).toHaveBeenCalledWith(1, 7);
    expect(mockInitializePayment).toHaveBeenCalledWith(expect.objectContaining({
      amount: 166250, currency: 'XOF', lmsItemId: '1',
      metadata: expect.objectContaining({ licence_count: 7, unit_price: '23750.00', discount_label: '5-9 sièges' }),
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('achat : licences non précisées → devis pour 1 licence', async () => {
    await controller.purchasePackage({ ...company, body: { package_id: 1 } }, response(), jest.fn());
    expect(mockQuote).toHaveBeenCalledWith(1, 1);
  });

  it('achat : devis refusé → erreur transmise, aucun paiement', async () => {
    mockQuote.mockRejectedValue(Object.assign(new Error('Nombre de licences invalide'), { statusCode: 400 }));
    const next = jest.fn();
    await controller.purchasePackage({ ...company, body: { package_id: 1, total_licenses: 99999 } }, response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(mockInitializePayment).not.toHaveBeenCalled();
  });

  it('ajout de licences : devis serveur sur le package de l\'entreprise', async () => {
    mockCompanyPackageFindOne.mockResolvedValue({
      id: 3, package_id: 1, total_licenses: 20, package: { id: 1, name: 'Pack Starter', price: '1', currency: 'EUR' },
    });
    const res = response();
    const next = jest.fn();
    await controller.addLicenses(
      { ...company, params: { id: '3' }, body: { additional_licenses: 7, amount: 1 } }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockCompanyPackageFindOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: '3', company_id: 42, status: 'active' },
    }));
    expect(mockQuote).toHaveBeenCalledWith(1, 7);
    expect(mockInitializePayment).toHaveBeenCalledWith(expect.objectContaining({
      amount: 166250, currency: 'XOF',
      metadata: expect.objectContaining({ purchase_type: 'add_licenses', company_package_id: '3', licence_count: 7 }),
    }));
    expect(res.json.mock.calls[0][0].data).toMatchObject({ new_total_licenses: 27, currency: 'XOF' });
  });

  it('ajout de licences : package d\'une autre entreprise → 404, aucun devis', async () => {
    mockCompanyPackageFindOne.mockResolvedValue(null);
    const next = jest.fn();
    await controller.addLicenses({ ...company, params: { id: '3' }, body: { additional_licenses: 2 } }, response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(mockQuote).not.toHaveBeenCalled();
  });
});
