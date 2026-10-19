/**
 * Tests unitaires — PackageQuoteService (package B2B vendu à la licence).
 */
import { jest, describe, it, expect, beforeAll } from '@jest/globals';

jest.unstable_mockModule('../../../config/database.js', () => ({ default: { query: jest.fn() } }));
jest.unstable_mockModule('../../../saga/pricing.service.js', () => ({
  PricingService: { findApplicableBreakpoint: jest.fn() },
}));

const PUBLISHED = { id: 1, name: 'Pack Starter Entreprise', price: '25000.00', currency: 'xof', status: 'published' };
const BREAKPOINTS = [
  { id: 6, min_seats: 5, max_seats: 9, discount_rate: '0.05', label: '5-9 sièges' },
  { id: 3, min_seats: 16, max_seats: 50, discount_rate: '0.60', label: '-60%' },
];

describe('PackageQuoteService', () => {
  let PackageQuoteService;
  beforeAll(async () => {
    ({ PackageQuoteService } = await import('../package-quote.service.js'));
  });

  const service = (row = PUBLISHED, opts = {}) => {
    const loadPackage = jest.fn(async () => row);
    const s = new PackageQuoteService({
      loadPackage,
      findApplicableBreakpoint: jest.fn(async (seats) =>
        opts.breakpoint !== undefined ? opts.breakpoint
          : BREAKPOINTS.find((b) => seats >= b.min_seats && (b.max_seats === null || seats <= b.max_seats)) ?? null),
      maxSeatsPerOrder: () => opts.max ?? 5000,
    });
    return Object.assign(s, { loadPackage });
  };

  it('1 licence : prix d\'une licence, sans remise, devise normalisée', async () => {
    await expect(service().quote(1, 1)).resolves.toMatchObject({
      packageId: 1, name: 'Pack Starter Entreprise', seats: 1, currency: 'XOF',
      basePrice: '25000.00', unitPrice: '25000.00', total: '25000.00', discountRate: '0.0000', discountLabel: null,
    });
  });

  it('prix × licences : 3 licences sans palier → 75 000', async () => {
    await expect(service().quote('1', '3')).resolves.toMatchObject({ unitPrice: '25000.00', total: '75000.00' });
  });

  it('palier 5-9 (−5 %) : 23 750 × 7 = 166 250', async () => {
    await expect(service().quote(1, 7)).resolves.toMatchObject({
      unitPrice: '23750.00', total: '166250.00', discountRate: '0.0500', discountLabel: '5-9 sièges',
      breakpoint: { id: 6, minSeats: 5, maxSeats: 9 },
    });
  });

  it('au-delà de l\'ancien max_licenses : un gros achat de licences reste possible (20 licences, −60 %)', async () => {
    await expect(service({ ...PUBLISHED, max_licenses: 10 }).quote(1, 20)).resolves.toMatchObject({
      seats: 20, unitPrice: '10000.00', total: '200000.00',
    });
  });

  it('arrondi exact au centime (pas de flottant)', async () => {
    // 33 333,33 × 0,95 = 31 666,6635 → 31 666,66 ; × 9 = 284 999,94
    await expect(service({ ...PUBLISHED, price: '33333.33' }).quote(1, 9))
      .resolves.toMatchObject({ unitPrice: '31666.66', total: '284999.94' });
  });

  it('licences ou identifiant invalides → 400 sans lecture en base', async () => {
    const s = service(PUBLISHED, { max: 100 });
    for (const seats of [0, -3, 2.5, 'abc', '', null, undefined, 101, 1e9]) {
      await expect(s.quote(1, seats)).rejects.toMatchObject({ statusCode: 400 });
    }
    for (const id of [0, 'x', -1, null]) {
      await expect(s.quote(id, 2)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(s.loadPackage).not.toHaveBeenCalled();
  });

  it('package introuvable → 404 ; brouillon ou archivé → 409', async () => {
    await expect(service(null).quote(1, 2)).rejects.toMatchObject({ statusCode: 404 });
    for (const status of ['draft', 'archived', null]) {
      await expect(service({ ...PUBLISHED, status }).quote(1, 2)).rejects.toMatchObject({ statusCode: 409 });
    }
  });

  it('devise absente, prix nul ou palier ≥ 100 % → 409, jamais un prix deviné', async () => {
    await expect(service({ ...PUBLISHED, currency: null }).quote(1, 2)).rejects.toMatchObject({ statusCode: 409 });
    await expect(service({ ...PUBLISHED, price: '0.00' }).quote(1, 2)).rejects.toMatchObject({ statusCode: 409 });
    const bad = { id: 9, min_seats: 1, max_seats: null, discount_rate: '1.00', label: 'gratuit' };
    await expect(service(PUBLISHED, { breakpoint: bad }).quote(1, 2)).rejects.toMatchObject({ statusCode: 409 });
  });
});
