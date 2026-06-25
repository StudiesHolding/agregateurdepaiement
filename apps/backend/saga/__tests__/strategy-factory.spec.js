/**
 * Tests unitaires — StrategyFactory
 *
 * Valide que la factory retourne la bonne stratégie
 * selon la source de l'événement.
 *
 * Scénarios :
 * TC-FACTORY-01 : B2B_PACKAGE → B2BPackageStrategy
 * TC-FACTORY-02 : MOODLE_HEADLESS → MoodleHeadlessStrategy
 * TC-FACTORY-03 : RETAIL → LegacyStrategy
 * TC-FACTORY-04 : AUCTION → LegacyStrategy
 * TC-FACTORY-05 : Source inconnue → Error
 */
import { resolveStrategy } from '../strategy-factory.js';
import { LegacyStrategy } from '../strategies/legacy.strategy.js';
import { B2BPackageStrategy } from '../strategies/b2b-package.strategy.js';
import { MoodleHeadlessStrategy } from '../strategies/moodle-headless.strategy.js';

describe('StrategyFactory', () => {
  // ─────────────────────────────────────────────────────────
  // TC-FACTORY-01 : B2B_PACKAGE
  // ─────────────────────────────────────────────────────────
  describe('TC-FACTORY-01: B2B_PACKAGE', () => {
    it('should return a B2BPackageStrategy instance for source "B2B_PACKAGE"', () => {
      const strategy = resolveStrategy('B2B_PACKAGE');
      expect(strategy).toBeInstanceOf(B2BPackageStrategy);
      expect(typeof strategy.execute).toBe('function');
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-FACTORY-02 : MOODLE_HEADLESS
  // ─────────────────────────────────────────────────────────
  describe('TC-FACTORY-02: MOODLE_HEADLESS', () => {
    it('should return a MoodleHeadlessStrategy instance for source "MOODLE_HEADLESS"', () => {
      const strategy = resolveStrategy('MOODLE_HEADLESS');
      expect(strategy).toBeInstanceOf(MoodleHeadlessStrategy);
      expect(typeof strategy.execute).toBe('function');
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-FACTORY-03 : RETAIL → LegacyStrategy
  // ─────────────────────────────────────────────────────────
  describe('TC-FACTORY-03: RETAIL', () => {
    it('should return a LegacyStrategy instance for source "RETAIL"', () => {
      const strategy = resolveStrategy('RETAIL');
      expect(strategy).toBeInstanceOf(LegacyStrategy);
      expect(typeof strategy.execute).toBe('function');
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-FACTORY-04 : AUCTION → LegacyStrategy
  // ─────────────────────────────────────────────────────────
  describe('TC-FACTORY-04: AUCTION', () => {
    it('should return a LegacyStrategy instance for source "AUCTION"', () => {
      const strategy = resolveStrategy('AUCTION');
      expect(strategy).toBeInstanceOf(LegacyStrategy);
    });
  });

  // ─────────────────────────────────────────────────────────
  // TC-FACTORY-05 : Source inconnue → Error
  // ─────────────────────────────────────────────────────────
  describe('TC-FACTORY-05: Unknown source', () => {
    it('should throw an error for unknown source "UNKNOWN"', () => {
      expect(() => resolveStrategy('UNKNOWN')).toThrow();
      expect(() => resolveStrategy('UNKNOWN')).toThrow(/unknown source/i);
    });

    it('should throw an error for empty source', () => {
      expect(() => resolveStrategy('')).toThrow();
    });

    it('should throw an error for null source', () => {
      expect(() => resolveStrategy(null)).toThrow();
    });
  });
});