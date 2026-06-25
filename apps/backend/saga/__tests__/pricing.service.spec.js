/**
 * Tests unitaires — PricingService
 *
 * Valide les calculs de tarification dégressive basés sur
 * la table sl_volume_breakpoints configurée par le super admin.
 *
 * Scénarios :
 * TC-PRICE-01 : 1 siège → pas de remise, prix plein
 * TC-PRICE-02 : 3 sièges → palier 2-5 (−20%)
 * TC-PRICE-03 : 10 sièges → palier 6-15 (−35%)
 * TC-PRICE-04 : 30 sièges → palier 16-50 (−60%)
 * TC-PRICE-05 : 100 sièges → palier 100+ (−65%)
 * TC-PRICE-06 : Package introuvable → PricingError
 * TC-PRICE-07 : Grille des paliers retournée correctement
 */
import { PricingService, PricingError } from '../pricing.service.js';

// Mock de sequelize.query
const mockQuery = jest.fn();

jest.mock('../config/database.js', () => ({
  __esModule: true,
  default: {
    query: (...args) => mockQuery(...args),
  },
}));

describe('PricingService', () => {
  /**
   * Helper : mock du package en base
   */
  function mockPackage(overrides = {}) {
    mockQuery.mockResolvedValueOnce([{
      id: 1,
      title: 'Python Pro',
      price: '120.00',
      currency: 'EUR',
      ...overrides,
    }]);
  }

  /**
   * Helper : mock des paliers en base (simule sl_volume_breakpoints)
   */
  function mockBreakpoints(breakpoints) {
    mockQuery.mockResolvedValueOnce(breakpoints);
  }

  beforeEach(() => {
    mockQuery.mockReset();
  });

  // ─────────────────────────────────────────────────────────
  // TC-PRICE-01 : 1 siège → pas de remise
  // ─────────────────────────────────────────────────────────
  describe('TC-PRICE-01: Single seat — no discount', () => {
    it('should return base price without discount for 1 seat', async () => {
      mockPackage();
      mockBreakpoints([]); // Aucun palier demandé car seatCount <= 1

      const result = await PricingService.calculate(1, 1);

      expect(result.unitPrice).toBe(120.00);
      expect(result.totalPrice).toBe(120.00);
      expect(result.discountRate).toBe(0);
      expect(result.discountLabel).toBe('-');
      expect(result.appliedBreakpoint).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-PRICE-02 : 3 sièges → palier 2-5 (−20%)
  // ─────────────────────────────────────────────────────────
  describe('TC-PRICE-02: 3 seats — tier 2-5 (-20%)', () => {
    it('should apply 20% discount for 3 seats', async () => {
      mockPackage();

      // findApplicableBreakpoint est appelé avec seatCount=3
      mockQuery.mockResolvedValueOnce([{
        id: 1,
        label: '-20%',
        min_seats: 2,
        max_seats: 5,
        discount_rate: 0.20,
        display_order: 1,
        is_active: true,
      }]);

      const result = await PricingService.calculate(1, 3);

      expect(result.seatCount).toBe(3);
      expect(result.basePrice).toBe(120);
      expect(result.discountRate).toBe(0.20);
      expect(result.discountLabel).toBe('-20%');
      expect(result.unitPrice).toBe(96.00);           // 120 * (1-0.20)
      expect(result.totalPrice).toBe(288.00);          // 96 * 3
      expect(result.appliedBreakpoint).toBeDefined();
      expect(result.appliedBreakpoint.minSeats).toBe(2);
      expect(result.appliedBreakpoint.maxSeats).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-PRICE-03 : 10 sièges → palier 6-15 (−35%)
  // ─────────────────────────────────────────────────────────
  describe('TC-PRICE-03: 10 seats — tier 6-15 (-35%)', () => {
    it('should apply 35% discount for 10 seats', async () => {
      mockPackage();
      mockQuery.mockResolvedValueOnce([{
        id: 2,
        label: '-35%',
        min_seats: 6,
        max_seats: 15,
        discount_rate: 0.35,
        display_order: 2,
        is_active: true,
      }]);

      const result = await PricingService.calculate(1, 10);

      expect(result.discountRate).toBe(0.35);
      expect(result.unitPrice).toBeCloseTo(78.00, 2); // 120 * 0.65
      expect(result.totalPrice).toBeCloseTo(780.00, 2); // 78 * 10
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-PRICE-04 : 30 sièges → palier 16-50 (−60%)
  // ─────────────────────────────────────────────────────────
  describe('TC-PRICE-04: 30 seats — tier 16-50 (-60%)', () => {
    it('should apply 60% discount for 30 seats', async () => {
      mockPackage();
      mockQuery.mockResolvedValueOnce([{
        id: 3,
        label: '-60%',
        min_seats: 16,
        max_seats: 50,
        discount_rate: 0.60,
        display_order: 3,
        is_active: true,
      }]);

      const result = await PricingService.calculate(1, 30);

      expect(result.discountRate).toBe(0.60);
      expect(result.unitPrice).toBeCloseTo(48.00, 2);  // 120 * 0.40
      expect(result.totalPrice).toBeCloseTo(1440.00, 2); // 48 * 30
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-PRICE-05 : 100 sièges → palier 100+ (−65%)
  // ─────────────────────────────────────────────────────────
  describe('TC-PRICE-05: 100 seats — tier 100+ (-65%)', () => {
    it('should apply 65% discount for 100 seats', async () => {
      mockPackage();
      mockQuery.mockResolvedValueOnce([{
        id: 4,
        label: '-65%',
        min_seats: 100,
        max_seats: null,   // null = jusqu'à l'infini
        discount_rate: 0.65,
        display_order: 4,
        is_active: true,
      }]);

      const result = await PricingService.calculate(1, 100);

      expect(result.discountRate).toBe(0.65);
      expect(result.unitPrice).toBeCloseTo(42.00, 2);  // 120 * 0.35
      expect(result.totalPrice).toBeCloseTo(4200.00, 2); // 42 * 100
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-PRICE-06 : Package introuvable → PricingError
  // ─────────────────────────────────────────────────────────
  describe('TC-PRICE-06: Package not found', () => {
    it('should throw PricingError when package does not exist', async () => {
      mockQuery.mockResolvedValueOnce([]); // Aucun package trouvé

      await expect(
        PricingService.calculate(99999, 5)
      ).rejects.toThrow(PricingError);
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-PRICE-07 : Grille des paliers
  // ─────────────────────────────────────────────────────────
  describe('TC-PRICE-07: Breakpoint grid', () => {
    it('should return the complete grid with all tiers', async () => {
      // getPackage
      mockQuery.mockResolvedValueOnce([{ id: 1, title: 'Python Pro', price: '120.00', currency: 'EUR' }]);

      // sl_volume_breakpoints findAll
      mockQuery.mockResolvedValueOnce([
        { id: 1, label: '-20%', min_seats: 2, max_seats: 5, discount_rate: 0.20, display_order: 1 },
        { id: 2, label: '-35%', min_seats: 6, max_seats: 15, discount_rate: 0.35, display_order: 2 },
        { id: 3, label: '-60%', min_seats: 16, max_seats: 50, discount_rate: 0.60, display_order: 3 },
        { id: 4, label: '-65%', min_seats: 100, max_seats: null, discount_rate: 0.65, display_order: 4 },
      ]);

      const grid = await PricingService.getBreakpointGrid(1);

      expect(grid).toHaveLength(5); // 1 prix plein + 4 paliers
      expect(grid[0].minSeats).toBe(1);  // 1 siège
      expect(grid[0].unitPrice).toBe(120.00); // Pas de remise
      expect(grid[1].label).toBe('-20%');  // 2-5
      expect(grid[2].label).toBe('-35%');  // 6-15
      expect(grid[3].label).toBe('-60%');  // 16-50
      expect(grid[4].label).toBe('-65%');  // 100+
    });
  });
});