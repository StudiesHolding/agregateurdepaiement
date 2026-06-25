/**
 * Tests unitaires — AuctionVerificationService
 *
 * Valide les 4 verrous anti-fraude pour les enchères.
 * Mock complet de la base de données via sequelize.query.
 *
 * Scénarios :
 * TC-FRAUD-01 : Happy path — tous les verrous passent
 * TC-FRAUD-02 : V1 — Prix modifié → FraudDetectionException
 * TC-FRAUD-03 : V2 — Statut 'active' → FraudDetectionException
 * TC-FRAUD-04 : V2 — Déjà payé → FraudDetectionException
 * TC-FRAUD-05 : V3 — Email ne correspond pas → FraudDetectionException
 * TC-FRAUD-06 : V4 — Mauvais rang cascade → FraudDetectionException
 */
import { AuctionVerificationService, FraudDetectionException } from '../auction-verification.service.js';

// Mock complet de sequelize
const mockQuery = jest.fn();

jest.mock('../config/database.js', () => ({
  __esModule: true,
  default: {
    query: (...args) => mockQuery(...args),
  },
}));

/**
 * Helper : construit une enchère mockée comme retournée par loadAuctionWithWinner
 */
function buildMockAuction(overrides = {}) {
  return {
    id: 42,
    formation_id: 15,
    title: 'Formation Test',
    starting_price: 100.00,
    current_price: 150.00,
    buy_now_price: 500.00,
    status: 'ended',
    payment_status: 'pending',
    highest_bidder_id: 1,
    winner_id: 1,
    winning_bid_id: 10,
    final_price: null,
    current_winner_rank: 1,
    start_date: '2026-06-01 10:00:00',
    end_date: '2026-06-24 18:00:00',
    cascade_deadline: '2026-06-25 18:00:00',
    winner_email: 'gagnant@example.com',
    winner_first_name: 'Jean',
    winner_last_name: 'Gagnant',
    created_at: '2026-06-01 10:00:00',
    updated_at: '2026-06-24 18:00:00',
    ...overrides,
  };
}

describe('AuctionVerificationService', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  // ─────────────────────────────────────────────────────────
  // TC-FRAUD-01 : Happy path — tous les verrous passent
  // ─────────────────────────────────────────────────────────
  describe('TC-FRAUD-01: Happy path — all verifications pass', () => {
    it('should return auction data when all 4 locks pass', async () => {
      mockQuery
        .mockResolvedValueOnce([buildMockAuction()]); // loadAuctionWithWinner

      const result = await AuctionVerificationService.verifyAll(
        42,
        150.00,
        'gagnant@example.com',
        1,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(42);
      expect(result.current_price).toBe('150.00');

      // Vérifier que la requête SQL a été exécutée
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.objectContaining({
          replacements: { auctionId: 42 },
        })
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-FRAUD-02 : V1 — Prix modifié
  // ─────────────────────────────────────────────────────────
  describe('TC-FRAUD-02: V1 — Price mismatch', () => {
    it('should throw FraudDetectionException when declared amount differs from current_price', async () => {
      mockQuery.mockResolvedValueOnce([buildMockAuction()]);

      // Le frontend déclare 100€ mais le prix en base est 150€
      await expect(
        AuctionVerificationService.verifyAll(42, 100.00, 'gagnant@example.com', 1)
      ).rejects.toThrow(FraudDetectionException);

      try {
        await AuctionVerificationService.verifyAll(42, 100.00, 'gagnant@example.com', 1);
      } catch (error) {
        expect(error.code).toBe('PRICE_MISMATCH');
        expect(error.context).toBeDefined();
        expect(error.context.expectedPrice).toBe(150);
        expect(error.context.receivedAmount).toBe(100);
      }
    });

    it('should accept amount with small rounding difference (< 0.01)', async () => {
      mockQuery.mockResolvedValueOnce([buildMockAuction()]);

      // 150.005 est considéré comme égal à 150.00
      const result = await AuctionVerificationService.verifyAll(
        42, 150.005, 'gagnant@example.com', 1
      );
      expect(result).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-FRAUD-03 : V2 — Statut 'active' (enchère pas finie)
  // ─────────────────────────────────────────────────────────
  describe('TC-FRAUD-03: V2 — Auction still active', () => {
    it('should throw FraudDetectionException when auction status is "active"', async () => {
      mockQuery.mockResolvedValueOnce([buildMockAuction({ status: 'active' })]);

      try {
        await AuctionVerificationService.verifyAll(42, 150.00, 'gagnant@example.com', 1);
        fail('Expected FraudDetectionException');
      } catch (error) {
        expect(error.code).toBe('AUCTION_STILL_ACTIVE');
        expect(error.context.status).toBe('active');
      }
    });

    it('should throw FraudDetectionException when auction is cancelled', async () => {
      mockQuery.mockResolvedValueOnce([buildMockAuction({ status: 'cancelled' })]);

      await expect(
        AuctionVerificationService.verifyAll(42, 150.00, 'gagnant@example.com', 1)
      ).rejects.toThrow(FraudDetectionException);
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-FRAUD-04 : V2 — Déjà payé
  // ─────────────────────────────────────────────────────────
  describe('TC-FRAUD-04: V2 — Already paid', () => {
    it('should throw FraudDetectionException when auction is "sold" and "paid"', async () => {
      mockQuery.mockResolvedValueOnce([buildMockAuction({
        status: 'sold',
        payment_status: 'paid',
        final_price: 150.00,
      })]);

      try {
        await AuctionVerificationService.verifyAll(42, 150.00, 'gagnant@example.com', 1);
        fail('Expected FraudDetectionException');
      } catch (error) {
        expect(error.code).toBe('AUCTION_ALREADY_PAID');
        expect(error.context.paymentStatus).toBe('paid');
      }
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-FRAUD-05 : V3 — Identité non correspondante
  // ─────────────────────────────────────────────────────────
  describe('TC-FRAUD-05: V3 — Identity mismatch', () => {
    it('should throw FraudDetectionException when email does not match winner', async () => {
      mockQuery
        .mockResolvedValueOnce([buildMockAuction()])          // loadAuctionWithWinner
        .mockResolvedValueOnce([{ count: 0 }]);               // isCascadeParticipant → 0

      try {
        await AuctionVerificationService.verifyAll(42, 150.00, 'fraudeur@example.com', 1);
        fail('Expected FraudDetectionException');
      } catch (error) {
        expect(error.code).toBe('IDENTITY_MISMATCH');
        expect(error.context.winnerEmail).toBe('gagnant@example.com');
        expect(error.context.attemptedEmail).toBe('fraudeur@example.com');
      }
    });

    it('should accept cascade participant email', async () => {
      mockQuery
        .mockResolvedValueOnce([buildMockAuction()])           // loadAuctionWithWinner
        .mockResolvedValueOnce([{ count: 1 }]);                // isCascadeParticipant → trouvé

      const result = await AuctionVerificationService.verifyAll(
        42, 150.00, 'second@example.com', 1
      );
      expect(result).toBeDefined();
    });

    it('should throw when winner_email is NULL', async () => {
      mockQuery.mockResolvedValueOnce([buildMockAuction({ winner_id: null, winner_email: null })]);

      await expect(
        AuctionVerificationService.verifyAll(42, 150.00, 'test@example.com', 1)
      ).rejects.toThrow(FraudDetectionException);
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-FRAUD-06 : V4 — Mauvais rang de cascade
  // ─────────────────────────────────────────────────────────
  describe('TC-FRAUD-06: V4 — Cascade rank mismatch', () => {
    it('should throw FraudDetectionException when declared rank does not match', async () => {
      mockQuery.mockResolvedValueOnce([buildMockAuction({ current_winner_rank: 2 })]);

      // Le joueur déclare être rank 1, mais le système attend rank 2
      try {
        await AuctionVerificationService.verifyAll(42, 150.00, 'gagnant@example.com', 1);
        fail('Expected FraudDetectionException');
      } catch (error) {
        expect(error.code).toBe('CASCADE_RANK_MISMATCH');
        expect(error.context.declaredRank).toBe(1);
        expect(error.context.expectedRank).toBe(2);
      }
    });

    it('should pass when no declared rank (simple auction without cascade)', async () => {
      mockQuery.mockResolvedValueOnce([buildMockAuction()]);

      // Pas de rang déclaré → pas de vérification cascade
      const result = await AuctionVerificationService.verifyAll(
        42, 150.00, 'gagnant@example.com', null
      );
      expect(result).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────
  // Cas supplémentaires : enchère introuvable
  // ─────────────────────────────────────────────────────────
  describe('Additional: auction not found', () => {
    it('should throw FraudDetectionException when auction does not exist', async () => {
      mockQuery.mockResolvedValueOnce([]); // Aucun résultat

      await expect(
        AuctionVerificationService.verifyAll(99999, 100, 'test@example.com')
      ).rejects.toThrow(FraudDetectionException);
    });
  });
});