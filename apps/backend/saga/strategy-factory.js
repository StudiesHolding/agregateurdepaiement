/**
 * StrategyFactory
 *
 * Factory pattern pour instancier la stratégie appropriée
 * selon la source de l'événement de paiement.
 *
 * Sources supportées :
 * - RETAIL : Achat direct B2C (via formulaire de paiement)
 * - AUCTION : Enchère gagnée
 * - B2B_PACKAGE : Achat de package entreprise
 * - MOODLE_HEADLESS : Inscription via Authoring Engine/Moodle
 */
import { LegacyStrategy } from './strategies/legacy.strategy.js';
import { B2BPackageStrategy } from './strategies/b2b-package.strategy.js';
import { MoodleHeadlessStrategy } from './strategies/moodle-headless.strategy.js';

/**
 * Stratégies disponibles
 */
const STRATEGIES = {
  RETAIL: LegacyStrategy,
  AUCTION: LegacyStrategy,
  B2B_PACKAGE: B2BPackageStrategy,
  MOODLE_HEADLESS: MoodleHeadlessStrategy,
};

/**
 * Résout la stratégie appropriée pour une source donnée.
 * Utilise le pattern Strategy : isole chaque flux métier
 * dans une classe dédiée.
 *
 * @param {string} source - Source de l'événement
 * @returns {Object} Instance de la stratégie
 */
export function resolveStrategy(source) {
  const StrategyClass = STRATEGIES[source];

  if (!StrategyClass) {
    throw new Error(`[StrategyFactory] Unknown source: "${source}". ` +
      `Supported sources: ${Object.keys(STRATEGIES).join(', ')}`);
  }

  console.log(`[StrategyFactory] Resolved ${source} → ${StrategyClass.name}`);
  return new StrategyClass();
}