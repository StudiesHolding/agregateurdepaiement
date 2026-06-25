/**
 * Tests unitaires — PricingService (mode ESM)
 * Utilise jest.unstable_mockModule + imports dynamiques
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ============================================================
// Mocks ESM
// ============================================================
const mockQuery = jest.fn();

jest.unstable_mockModule('../config/database.js', () => ({
  __esModule: true,
  default: { query: mockQuery },
}));

describe('PricingService', () => {
  let PricingService, PricingError;

  beforeAll(async () => {
    const mod = await import('../pricing.service.js');
    PricingService = mod.PricingService;
    PricingError = mod.PricingError;
  });

  beforeEach(() => { mockQuery.mockReset(); });

  it('TC-PRICE-01: should return base price for 1 seat', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 1, price: '120.00', currency: 'EUR' }]);
    mockQuery.mockResolvedValueOnce([]);
    const r = await PricingService.calculate(1, 1);
    expect(r.unitPrice).toBe(120.00);
    expect(r.totalPrice).toBe(120.00);
    expect(r.appliedBreakpoint).toBeNull();
  });

  it('TC-PRICE-02: 3 seats → -20%', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 1, price: '120.00', currency: 'EUR' }]);
    mockQuery.mockResolvedValueOnce([{ id: 1, label: '-20%', min_seats: 2, max_seats: 5, discount_rate: 0.20 }]);
    const r = await PricingService.calculate(1, 3);
    expect(r.discountRate).toBe(0.20);
    expect(r.unitPrice).toBe(96.00);
    expect(r.totalPrice).toBe(288.00);
  });

  it('TC-PRICE-03: 10 seats → -35%', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 1, price: '120.00', currency: 'EUR' }]);
    mockQuery.mockResolvedValueOnce([{ id: 2, label: '-35%', min_seats: 6, max_seats: 15, discount_rate: 0.35 }]);
    const r = await PricingService.calculate(1, 10);
    expect(r.unitPrice).toBeCloseTo(78.00, 2);
    expect(r.totalPrice).toBeCloseTo(780.00, 2);
  });

  it('TC-PRICE-04: 30 seats → -60%', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 1, price: '120.00', currency: 'EUR' }]);
    mockQuery.mockResolvedValueOnce([{ id: 3, label: '-60%', min_seats: 16, max_seats: 50, discount_rate: 0.60 }]);
    const r = await PricingService.calculate(1, 30);
    expect(r.unitPrice).toBeCloseTo(48.00, 2);
    expect(r.totalPrice).toBeCloseTo(1440.00, 2);
  });

  it('TC-PRICE-05: 100 seats → -65%', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 1, price: '120.00', currency: 'EUR' }]);
    mockQuery.mockResolvedValueOnce([{ id: 4, label: '-65%', min_seats: 100, max_seats: null, discount_rate: 0.65 }]);
    const r = await PricingService.calculate(1, 100);
    expect(r.unitPrice).toBeCloseTo(42.00, 2);
    expect(r.totalPrice).toBeCloseTo(4200.00, 2);
  });

  it('TC-PRICE-06: should throw PricingError when package not found', async () => {
    mockQuery.mockResolvedValueOnce([]);
    await expect(PricingService.calculate(99999, 5)).rejects.toThrow(PricingError);
  });

  it('TC-PRICE-07: should return breakpoint grid', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 1, title: 'Python Pro', price: '120.00', currency: 'EUR' }]);
    mockQuery.mockResolvedValueOnce([
      { id: 1, label: '-20%', min_seats: 2, max_seats: 5, discount_rate: 0.20 },
      { id: 2, label: '-35%', min_seats: 6, max_seats: 15, discount_rate: 0.35 },
      { id: 3, label: '-60%', min_seats: 16, max_seats: 50, discount_rate: 0.60 },
      { id: 4, label: '-65%', min_seats: 100, max_seats: null, discount_rate: 0.65 },
    ]);
    const grid = await PricingService.getBreakpointGrid(1);
    expect(grid).toHaveLength(5);
    expect(grid[0].unitPrice).toBe(120.00);
    expect(grid[1].label).toBe('-20%');
  });
});