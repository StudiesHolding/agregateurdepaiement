/**
 * SlBackendCommissionClient
 *
 * Client HTTP vers le backend métier Studies Learning pour le crédit de
 * commission après une inscription réussie (ticket S1-5).
 *
 * Point d'entrée (idempotent par orderRef + formationId) :
 *   POST {SL_BACKEND_URL}/api/internal/payments/confirmed
 *   En-tête : X-Internal-Api-Key: {INTERNAL_API_KEY}
 *   Corps : { orderRef, formationId, studentId, grossAmount, currency,
 *             channel, paidAt, correlationId }
 *
 * Réponses :
 * - 200 : { credited, beneficiary, walletId?, amount?, rate?, idempotentReplay }
 * - 400 : corps invalide → échec définitif
 * - 401 : clé invalide → échec définitif
 * - 429 / 5xx / réseau → réessayable
 *
 * Sécurité : la clé n'apparaît jamais dans les logs (en-tête uniquement).
 */
import axios from 'axios';

export const COMMISSION_CREDIT_PATH = '/api/internal/payments/confirmed';

/** Délai par défaut : 10 s */
export const DEFAULT_COMMISSION_CREDIT_TIMEOUT_MS = 10000;

/**
 * Un statut HTTP est réessayable si réseau indisponible (normalisé en 503),
 * trop de requêtes (429) ou erreur serveur (5xx).
 * 400/401 (et tout autre 4xx) sont des échecs définitifs.
 */
export function isRetryableCommissionStatus(status) {
  return status === 429 || (typeof status === 'number' && status >= 500);
}

/**
 * La fonctionnalité de crédit de commission est activée par défaut
 * (COMMISSION_CREDIT_ENABLED, défaut true ; désactivée uniquement par 'false').
 */
export function isCommissionCreditEnabled(env = process.env) {
  return String(env.COMMISSION_CREDIT_ENABLED ?? 'true').toLowerCase() !== 'false';
}

/**
 * Validation de configuration au démarrage (exigence S1-5 n°5).
 * Hors test, le démarrage doit être refusé si SL_BACKEND_URL / INTERNAL_API_KEY
 * sont absentes alors que la fonctionnalité est activée.
 *
 * @returns {{ enabled: boolean, valid: boolean, missing: string[], isTest: boolean }}
 */
export function validateCommissionCreditConfig(env = process.env) {
  const enabled = isCommissionCreditEnabled(env);
  const isTest = env.NODE_ENV === 'test';

  if (!enabled) {
    return { enabled, valid: true, missing: [], isTest };
  }

  const missing = [];
  if (!env.SL_BACKEND_URL) missing.push('SL_BACKEND_URL');
  if (!env.INTERNAL_API_KEY) missing.push('INTERNAL_API_KEY');

  return { enabled, valid: isTest || missing.length === 0, missing, isTest };
}

export class SlBackendCommissionClient {
  constructor() {
    this.baseUrl = process.env.SL_BACKEND_URL;
    this.apiKey = process.env.INTERNAL_API_KEY;
    this.timeout = parseInt(
      process.env.COMMISSION_CREDIT_TIMEOUT_MS || String(DEFAULT_COMMISSION_CREDIT_TIMEOUT_MS),
      10,
    );
  }

  /** SL_BACKEND_URL et INTERNAL_API_KEY renseignées */
  isConfigured() {
    return Boolean(this.baseUrl && this.apiKey);
  }

  /**
   * Demande le crédit de commission au backend métier.
   *
   * @param {Object} payload - Corps exact attendu par le backend
   * @param {string} correlationId - ID de corrélation de la saga (tracing)
   * @returns {Promise<{status: number, data: Object}>}
   *   Les erreurs réseau / timeout sont normalisées en status 503
   *   (même convention que M2MHttpClient), donc réessayables.
   */
  async creditCommission(payload, correlationId) {
    if (!this.isConfigured()) {
      throw new Error(
        'SlBackendCommissionClient: SL_BACKEND_URL et INTERNAL_API_KEY doivent être configurés',
      );
    }

    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}${COMMISSION_CREDIT_PATH}`,
        data: payload,
        headers: {
          'X-Internal-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
          ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
        },
        timeout: this.timeout,
        validateStatus: null, // On gère tous les codes HTTP nous-mêmes
      });

      return { status: response.status, data: response.data || {} };
    } catch (err) {
      // Réseau indisponible / timeout / DNS → 503 réessayable
      return {
        status: 503,
        data: { code: 'SL_BACKEND_UNREACHABLE', message: err.message },
      };
    }
  }
}

export default SlBackendCommissionClient;
