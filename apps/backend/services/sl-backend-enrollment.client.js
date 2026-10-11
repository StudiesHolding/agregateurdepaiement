/**
 * Client HTTP vers le backend métier — inscription après paiement confirmé (ADR-0012, E1/P5).
 *
 *   POST {SL_BACKEND_URL}/api/internal/enrollments   (en-tête X-Internal-Api-Key)
 *   Corps : { email | userId, formationId, orderRef, lineRef, source, ref? }
 *   Idempotent côté backend (clé order:<ref>:<ligne>) : rejouer ne crée jamais de doublon.
 *
 * Réponses : 201/200 inscription (canal d'attribution vérifié côté serveur) ; 404 compte ou formation
 * introuvable, 400/401/409 → échec définitif ; 429 / 5xx / réseau → réessayable (normalisé en 503).
 */
import axios from 'axios';

export const ENROLLMENT_PATH = '/api/internal/enrollments';
export const DEFAULT_ENROLLMENT_TIMEOUT_MS = 10000;

export function isRetryableEnrollmentStatus(status) {
  return status === 429 || (typeof status === 'number' && status >= 500);
}

export class SlBackendEnrollmentClient {
  constructor(env = process.env) {
    this.baseUrl = (env.SL_BACKEND_URL || '').replace(/\/+$/, '');
    this.apiKey = env.INTERNAL_API_KEY;
    this.timeout = parseInt(env.ENROLLMENT_TIMEOUT_MS || String(DEFAULT_ENROLLMENT_TIMEOUT_MS), 10);
  }

  isConfigured() {
    return Boolean(this.baseUrl && this.apiKey);
  }

  /** @returns {Promise<{status: number, data: Object}>} — les erreurs réseau sont normalisées en 503 */
  async enroll(payload, correlationId) {
    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}${ENROLLMENT_PATH}`,
        data: payload,
        headers: {
          'X-Internal-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
          ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
        },
        timeout: this.timeout,
        validateStatus: null,
      });
      return { status: response.status, data: response.data || {} };
    } catch (err) {
      return { status: 503, data: { code: 'SL_BACKEND_UNREACHABLE', message: err.message } };
    }
  }
}

export default SlBackendEnrollmentClient;
