/**
 * Tests unitaires — AuctionVerificationService (mode ESM)
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

function buildMockAuction(overrides = {}) {
  return {
    id: 42, formation_id: 15, title: 'Test',
    starting_price: 100.00, current_price: 150.00, buy_now_price: 500.00,
    status: 'ended', payment_status: 'pending',
    highest_bidder_id: 1, winner_id: 1, winning_bid_id: 10,
    final_price: null, current_winner_rank: 1,
    start_date: '2026-06-01', end_date: '2026-06-24',
    cascade_deadline: '2026-06-25 18:00:00',
    winner_email: 'gagnant@example.com',
    winner_first_name: 'Jean', winner_last_name: 'Gagnant',
    created_at: '2026-06-01', updated_at: '2026-06-24',
    ...overrides,
  };
}

describe('AuctionVerificationService', () => {
  let AuctionVerificationService, FraudDetectionException;

  beforeAll(async () => {
    const mod = await import('../auction-verification.service.js');
    AuctionVerificationService = mod.AuctionVerificationService;
    FraudDetectionException = mod.FraudDetectionException;
  });

  beforeEach(() => { mockQuery.mockReset(); });

  it('TC-FRAUD-01: should pass all 4 locks', async () => {
    mockQuery.mockResolvedValueOnce([buildMockAuction()]);
    const result = await AuctionVerificationService.verifyAll(42, 150.00, 'gagnant@example.com', 1);
    expect(result.id).toBe(42);
  });

  it('TC-FRAUD-02: V1 — should reject price mismatch', async () => {
    mockQuery.mockResolvedValueOnce([buildMockAuction()]);
    await expect(AuctionVerificationService.verifyAll(42, 100.00, 'gagnant@example.com', 1))
      .rejects.toThrow(FraudDetectionException);
  });

  it('TC-FRAUD-02b: V1 — should accept rounding diff < 0.01', async () => {
    mockQuery.mockResolvedValueOnce([buildMockAuction()]);
    const result = await AuctionVerificationService.verifyAll(42, 150.005, 'gagnant@example.com', 1);
    expect(result).toBeDefined();
  });

  it('TC-FRAUD-03: V2 — should reject active auction', async () => {
    mockQuery.mockResolvedValueOnce([buildMockAuction({ status: 'active' })]);
    await expect(AuctionVerificationService.verifyAll(42, 150.00, 'gagnant@example.com', 1))
      .rejects.toThrow(FraudDetectionException);
  });

  it('TC-FRAUD-03b: V2 — should reject cancelled', async () => {
    mockQuery.mockResolvedValueOnce([buildMockAuction({ status: 'cancelled' })]);
    await expect(AuctionVerificationService.verifyAll(42, 150.00, 'gagnant@example.com', 1))
      .rejects.toThrow(FraudDetectionException);
  });

  it('TC-FRAUD-04: V2 — should reject already paid', async () => {
    mockQuery.mockResolvedValueOnce([buildMockAuction({ status: 'sold', payment_status: 'paid' })]);
    await expect(AuctionVerificationService.verifyAll(42, 150.00, 'gagnant@example.com', 1))
      .rejects.toThrow(FraudDetectionException);
  });

  it('TC-FRAUD-05: V3 — should reject identity mismatch', async () => {
    mockQuery.mockResolvedValueOnce([buildMockAuction()]).mockResolvedValueOnce([{ count: 0 }]);
    await expect(AuctionVerificationService.verifyAll(42, 150.00, 'fraudeur@example.com', 1))
      .rejects.toThrow(FraudDetectionException);
  });

  it('TC-FRAUD-05b: V3 — should accept cascade participant', async () => {
    mockQuery.mockResolvedValueOnce([buildMockAuction()]).mockResolvedValueOnce([{ count: 1 }]);
    const result = await AuctionVerificationService.verifyAll(42, 150.00, 'second@example.com', 1);
    expect(result).toBeDefined();
  });

  it('TC-FRAUD-06: V4 — should reject cascade rank mismatch', async () => {
    mockQuery.mockResolvedValueOnce([buildMockAuction({ current_winner_rank: 2 })]);
    await expect(AuctionVerificationService.verifyAll(42, 150.00, 'gagnant@example.com', 1))
      .rejects.toThrow(FraudDetectionException);
  });

  it('TC-FRAUD-06b: V4 — should pass without declared rank', async () => {
    mockQuery.mockResolvedValueOnce([buildMockAuction()]);
    const result = await AuctionVerificationService.verifyAll(42, 150.00, 'gagnant@example.com', null);
    expect(result).toBeDefined();
  });

  it('should reject non-existent auction', async () => {
    mockQuery.mockResolvedValueOnce([]);
    await expect(AuctionVerificationService.verifyAll(99999, 100, 'test@example.com'))
      .rejects.toThrow(FraudDetectionException);
  });
});