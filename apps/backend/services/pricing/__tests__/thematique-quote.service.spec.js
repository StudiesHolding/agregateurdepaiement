/**
 * Tests unitaires — ThematiqueQuoteService (devis de licences de thématique B2B).
 */
import { jest, describe, it, expect, beforeAll } from '@jest/globals';

jest.unstable_mockModule('../../../config/database.js', () => ({ default: { query: jest.fn() } }));
jest.unstable_mockModule('../../../saga/pricing.service.js', () => ({
  PricingService: { findApplicableBreakpoint: jest.fn() },
}));

const ACTIVE = {
  id: 7, title: 'Leadership & Management', thematique_status: 'ACTIVE',
  type_name: 'Premium', base_price: '50000.00', currency: 'xaf', type_status: 'ACTIVE',
};
const BREAKPOINTS = [
  { id: 1, min_seats: 10, max_seats: 49, discount_rate: '0.1000', label: 'Équipe' },
  { id: 2, min_seats: 50, max_seats: null, discount_rate: '0.2500', label: 'Entreprise' },
];

describe('ThematiqueQuoteService', () => {
  let ThematiqueQuoteService;
  beforeAll(async () => {
    ({ ThematiqueQuoteService } = await import('../thematique-quote.service.js'));
  });

  const service = (row = ACTIVE, opts = {}) => new ThematiqueQuoteService({
    loadThematique: jest.fn(async () => row),
    findApplicableBreakpoint: jest.fn(async (seats) =>
      opts.breakpoint !== undefined ? opts.breakpoint
        : BREAKPOINTS.find((b) => seats >= b.min_seats && (b.max_seats === null || seats <= b.max_seats)) ?? null),
    maxSeatsPerOrder: () => opts.max ?? 5000,
  });

  it('1 licence : prix de base du type, sans remise, devise normalisée', async () => {
    await expect(service().quote(7, 1)).resolves.toMatchObject({
      seats: 1, unitPrice: '50000.00', total: '50000.00', currency: 'XAF', discountRate: '0.0000', discountLabel: null,
    });
  });

  it('palier « Équipe » (10 licences, −10 %) → 45 000 × 10', async () => {
    await expect(service().quote('7', '10')).resolves.toMatchObject({
      unitPrice: '45000.00', total: '450000.00', discountRate: '0.1000', discountLabel: 'Équipe',
    });
  });

  it('palier « Entreprise » (120 licences, −25 %) → 37 500 × 120', async () => {
    await expect(service().quote(7, 120)).resolves.toMatchObject({
      unitPrice: '37500.00', total: '4500000.00', discountLabel: 'Entreprise',
    });
  });

  it('arrondi exact au centime (pas de flottant)', async () => {
    const row = { ...ACTIVE, base_price: '33333.33' };
    // 33 333,33 × 0,9 = 29 999,997 → 30 000,00 ; × 10 = 300 000,00
    await expect(service(row).quote(7, 10)).resolves.toMatchObject({ unitPrice: '30000.00', total: '300000.00' });
  });

  it('licences invalides ou au-delà du plafond → 400 sans lecture en base', async () => {
    const s = service(ACTIVE, { max: 100 });
    for (const seats of [0, -3, 2.5, 'abc', '', null, 101, 1e9]) {
      await expect(s.quote(7, seats)).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(s.deps.loadThematique).not.toHaveBeenCalled();
  });

  it('thématique introuvable → 404 ; thématique ou type non actif → 409', async () => {
    await expect(service(null).quote(7, 1)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service({ ...ACTIVE, thematique_status: 'DRAFT' }).quote(7, 1)).rejects.toMatchObject({ statusCode: 409 });
    await expect(service({ ...ACTIVE, type_status: 'ARCHIVED' }).quote(7, 1)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('prix de base nul ou palier mal configuré (≥ 100 %) → 409, jamais un prix nul', async () => {
    await expect(service({ ...ACTIVE, base_price: '0.00' }).quote(7, 1)).rejects.toMatchObject({ statusCode: 409 });
    await expect(service(ACTIVE, { breakpoint: { id: 9, min_seats: 1, max_seats: null, discount_rate: '1.0000', label: 'X' } })
      .quote(7, 5)).rejects.toMatchObject({ statusCode: 409 });
  });
});
