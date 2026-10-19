/**
 * Client HTTP vers le backend métier — paiements des candidatures (ADR-0016, D6 bis).
 *
 *   GET  {SL_BACKEND_URL}/api/internal/admissions/:id/checkout?kind=offer|fee
 *   POST {SL_BACKEND_URL}/api/internal/admissions/:id/pending   { kind, orderRef }
 *   POST {SL_BACKEND_URL}/api/internal/admissions/:id/fee-paid  { orderRef }
 * En-tête X-Internal-Api-Key. Montant, devise et bénéficiaire viennent du backend : jamais du navigateur.
 * Erreurs réseau normalisées en 503 (réessayables), comme le client des inscriptions.
 */
import axios from 'axios';

export const ADMISSIONS_PATH = '/api/internal/admissions';

export function isRetryableAdmissionStatus(status) {
  return status === 429 || (typeof status === 'number' && status >= 500);
}

export class SlBackendAdmissionClient {
  constructor(env = process.env) {
    this.baseUrl = (env.SL_BACKEND_URL || '').replace(/\/+$/, '');
    this.apiKey = env.INTERNAL_API_KEY;
    this.timeout = parseInt(env.ENROLLMENT_TIMEOUT_MS || '10000', 10);
  }

  isConfigured() {
    return Boolean(this.baseUrl && this.apiKey);
  }

  async request(method, path, data, correlationId) {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${ADMISSIONS_PATH}${path}`,
        data,
        headers: { 'X-Internal-Api-Key': this.apiKey, 'Content-Type': 'application/json', ...(correlationId ? { 'x-correlation-id': correlationId } : {}) },
        timeout: this.timeout,
        validateStatus: null,
      });
      return { status: response.status, data: response.data || {} };
    } catch (err) {
      return { status: 503, data: { code: 'SL_BACKEND_UNREACHABLE', message: err.message } };
    }
  }

  checkout(candidatureId, kind) {
    return this.request('get', `/${candidatureId}/checkout?kind=${kind}`);
  }

  pending(candidatureId, kind, orderRef) {
    return this.request('post', `/${candidatureId}/pending`, { kind, orderRef });
  }

  feePaid(candidatureId, orderRef, correlationId) {
    return this.request('post', `/${candidatureId}/fee-paid`, { orderRef }, correlationId);
  }
}

export default SlBackendAdmissionClient;
