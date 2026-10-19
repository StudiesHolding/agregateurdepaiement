/**
 * Client HTTP vers le backend métier — coupons (ADR-0012, D6 bis).
 *
 *   POST {SL_BACKEND_URL}/api/internal/coupons/quote               { code, formationId, email? }  → devis sans réservation
 *   POST {SL_BACKEND_URL}/api/internal/coupons/reserve             { code, formationId, email }   → réservation de 45 min
 *   POST {SL_BACKEND_URL}/api/internal/coupons/:reservationId/confirm  { orderRef }                → idempotent
 *   POST {SL_BACKEND_URL}/api/internal/coupons/:reservationId/release                              → idempotent
 * En-tête X-Internal-Api-Key. Le prix final est calculé par le backend métier, jamais ici.
 * Réponses : 200 (devis valide ou refus motivé `valid: false`) ; 429 / 5xx / réseau → réessayable (normalisé en 503).
 */
import axios from 'axios';

export const COUPON_PATH = '/api/internal/coupons';
const TIMEOUT_MS = 8000;
const RESERVATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isRetryableCouponStatus(status) {
  return status === 429 || (typeof status === 'number' && status >= 500);
}

export class SlBackendCouponClient {
  constructor(env = process.env) {
    this.baseUrl = (env.SL_BACKEND_URL || '').replace(/\/+$/, '');
    this.apiKey = env.INTERNAL_API_KEY;
  }

  isConfigured() {
    return Boolean(this.baseUrl && this.apiKey);
  }

  quote(code, formationId, email) {
    return this.post('/quote', { code, formationId, ...(email ? { email } : {}) });
  }

  reserve(code, formationId, email) {
    return this.post('/reserve', { code, formationId, email });
  }

  confirm(reservationId, orderRef) {
    if (!RESERVATION_ID.test(String(reservationId))) return Promise.resolve({ status: 400, data: { code: 'INVALID_RESERVATION' } });
    return this.post(`/${reservationId}/confirm`, { orderRef });
  }

  release(reservationId) {
    if (!RESERVATION_ID.test(String(reservationId))) return Promise.resolve({ status: 400, data: { code: 'INVALID_RESERVATION' } });
    return this.post(`/${reservationId}/release`, {});
  }

  /** @returns {Promise<{status: number, data: Object}>} — erreurs réseau normalisées en 503 */
  async post(path, body) {
    if (!this.isConfigured()) return { status: 503, data: { code: 'SL_BACKEND_NOT_CONFIGURED' } };
    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}${COUPON_PATH}${path}`,
        data: body,
        headers: { 'X-Internal-Api-Key': this.apiKey, 'Content-Type': 'application/json' },
        timeout: TIMEOUT_MS,
        validateStatus: null,
      });
      return { status: response.status, data: response.data || {} };
    } catch (err) {
      return { status: 503, data: { code: 'SL_BACKEND_UNREACHABLE', message: err.message } };
    }
  }
}

export default SlBackendCouponClient;
